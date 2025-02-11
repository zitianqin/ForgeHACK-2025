import api, { route } from "@forge/api";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function analyseWithGroq(query, content) {
  const prompt = `
    Given the following content, determine if it contains relevant information for this query: "${query}"
    If it does, extract the most relevant portion.
    Content: ${content}
    
    Respond in JSON format:
    {
      "isRelevant": boolean,
      "relevantText": string or null,
      "confidence": "high" | "medium" | "low"
    }
  `;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "mixtral-8x7b-32768",
  });

  return JSON.parse(completion.choices[0].message.content);
}

export async function deepSearch(payload) {
  const query = payload.query.toLowerCase();
  console.log(`Searching Confluence for query: ${query}`);

  try {
    const response = await api
      .asUser()
      .requestConfluence(route`/wiki/api/v2/pages?limit=100`, {
        headers: {
          Accept: "application/json",
        },
      });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch pages: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log(`Searching through ${data.results.length} pages...`);

    for (const page of data.results) {
      console.log(`Analyzing page: "${page.title}"`);

      const contentResponse = await api
        .asUser()
        .requestConfluence(
          route`/wiki/api/v2/pages/${page.id}?body-format=storage`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

      if (!contentResponse.ok) {
        console.log(`Failed to fetch content for page ${page.id}`);
        continue;
      }

      const content = await contentResponse.json();
      const pageContent = content.body.storage.value;

      const analysis = await analyseWithGroq(query, pageContent);

      if (analysis.isRelevant && analysis.relevantText) {
        const result = {
          pageTitle: page.title,
          pageId: page.id,
          url: page._links.webui,
          answer: analysis.relevantText,
          confidence: analysis.confidence,
          message: `Found relevant information in page "${page.title}" with ${analysis.confidence} confidence.`,
        };
        console.log("Found matching content:", result);
        return result;
      }
    }

    return {
      message: `Could not find any information matching "${query}". Please try rephrasing your query.`,
    };
  } catch (error) {
    console.error("Error searching for information:", error);
    return {
      message: `Error searching for information: ${error.message}`,
    };
  }
}
