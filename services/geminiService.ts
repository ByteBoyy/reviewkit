import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Review, AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface BusinessSearchResult {
  title: string;
  address: string;
  rating?: string;
  uri?: string;
}

const cleanJsonResponse = (text: string): string => {
  if (!text) return "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

export const searchBusinesses = async (query: string): Promise<BusinessSearchResult[]> => {
  // Use gemini-2.5-flash which is required for the googleMaps tool
  // We specifically ask for a structured format in the text to make parsing reliable
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Find real-world business locations matching the search query: "${query}". 
    For each business you find, provide the full business name and its complete physical address (Street, City/Town, and Country).
    
    Format your response as a numbered list like this:
    1. [Business Name] | [Full Street Address, City, Town, Country]
    2. [Business Name] | [Full Street Address, City, Town, Country]`,
    config: {
      tools: [{ googleMaps: {} }],
    },
  });

  const results: BusinessSearchResult[] = [];
  const text = response.text || "";
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  
  // First, parse the text response for detailed addresses
  const lines = text.split('\n').filter(l => l.trim().length > 5);
  
  lines.forEach(line => {
    // Remove list numbers and markdown
    const cleanLine = line.replace(/^\d+\.\s*/, '').replace(/[*#]/g, '').trim();
    
    let title = "";
    let address = "";

    if (cleanLine.includes('|')) {
      const parts = cleanLine.split('|');
      title = parts[0]?.trim();
      address = parts[1]?.trim();
    } else if (cleanLine.includes(' - ')) {
      const parts = cleanLine.split(' - ');
      title = parts[0]?.trim();
      address = parts[1]?.trim();
    } else if (cleanLine.includes(': ')) {
      const parts = cleanLine.split(': ');
      title = parts[0]?.trim();
      address = parts[1]?.trim();
    }

    if (title && address) {
      // Try to find a matching Maps URI from the grounding chunks to add the link
      const matchingChunk = chunks.find(c => 
        c.maps && (
          title.toLowerCase().includes(c.maps.title?.toLowerCase() || "") || 
          (c.maps.title && title.toLowerCase().includes(c.maps.title.toLowerCase()))
        )
      );

      results.push({
        title,
        address,
        uri: matchingChunk?.maps?.uri
      });
    }
  });

  // Fallback: If text parsing failed but we have Maps grounding chunks, use those
  if (results.length === 0) {
    chunks.forEach(chunk => {
      if (chunk.maps) {
        results.push({
          title: chunk.maps.title || "Business Location",
          address: "Address details in Google Maps link",
          uri: chunk.maps.uri
        });
      }
    });
  }

  // De-duplicate by title
  const finalMap = new Map<string, BusinessSearchResult>();
  results.forEach(res => {
    const existing = finalMap.get(res.title);
    // Keep the one with the longer address description
    if (!existing || (existing.address.length < res.address.length)) {
      finalMap.set(res.title, res);
    }
  });

  return Array.from(finalMap.values()).slice(0, 6);
};

export const analyzeReviews = async (reviews: Review[]): Promise<AnalysisResult> => {
  const limitedReviews = reviews.slice(0, 50);
  
  const reviewsText = limitedReviews
    .map(r => `Rating: ${r.rating}/5. Review: "${r.text}"`)
    .join('\n\n');

  const prompt = `Analyze the following business reviews and provide a comprehensive business intelligence report in JSON format.
  
  IMPORTANT: The 'sentiment.score' must be a percentage between 0 and 100. 
  
  Reviews to analyze:
  ${reviewsText}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: "You are a professional business analyst. Output valid JSON only. Ensure the sentiment score is a 0-100 integer representing brand advocacy level.",
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 4000 },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overview: { type: Type.STRING },
          sentiment: {
            type: Type.OBJECT,
            properties: {
              positive: { type: Type.NUMBER },
              neutral: { type: Type.NUMBER },
              negative: { type: Type.NUMBER },
              score: { 
                type: Type.NUMBER,
                description: "Aggregated sentiment score from 0 to 100."
              }
            },
            required: ["positive", "neutral", "negative", "score"]
          },
          themes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                sentiment: { type: Type.STRING },
                frequency: { type: Type.NUMBER },
                description: { type: Type.STRING }
              },
              required: ["name", "sentiment", "frequency", "description"]
            }
          },
          recommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          swot: {
            type: Type.OBJECT,
            properties: {
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
              threats: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["strengths", "weaknesses", "opportunities", "threats"]
          }
        },
        required: ["overview", "sentiment", "themes", "recommendations", "swot"]
      }
    }
  });

  try {
    const rawText = response.text || "";
    const cleanedText = cleanJsonResponse(rawText);
    if (!cleanedText) throw new Error("AI response was empty or non-JSON.");
    return JSON.parse(cleanedText);
  } catch (err) {
    console.error("Analysis Parse Error:", err, response.text);
    throw new Error("Invalid intelligence format received. Please retry in a moment.");
  }
};

export const createReviewChat = (reviews: Review[]): Chat => {
  const reviewsText = reviews
    .map(r => `[Source: ${r.source}, Rating: ${r.rating}, Date: ${r.date}] ${r.author}: "${r.text}"`)
    .join('\n');

  const systemInstruction = `You are "Review Kit AI Assistant". Answer questions based strictly on these reviews:
  ${reviewsText}`;

  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction,
    },
  });
};