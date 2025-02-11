import api, { route } from "@forge/api";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function extractKeywords(query) {
  const prompt = `
    Extract only the important keywords from this query as space-separated words.
    Rules:
    - Return ONLY the keywords, no other text
    - Separate keywords with single spaces
    - Remove articles, prepositions, and other stop words
    - Keep only meaningful search terms
    - Do not include punctuation
    - Do not include explanatory text
    
    Query: "${query}"
    `;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "mixtral-8x7b-32768",
    temperature: 0.1, // Low temperature for more consistent output
  });

  return completion.choices[0].message.content.trim();
}

export async function deepSearch(payload) {
  const query = payload.query;
  console.log(`Searching Confluence for query: ${query}`);

  // Extract keywords from query
  const keywords = await extractKeywords(query);
  console.log(`Extracted keywords: ${keywords}`);

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

    // Search through pages for query matches
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

      // Look for if any of the keywords is in content
      if (
        keywords.split(" ").some((keyword) => pageContent.includes(keyword))
      ) {
        // Extract relevant context around the query match
        const matchIndex = pageContent.indexOf(query);
        const contextStart = Math.max(0, matchIndex - 150);
        const contextEnd = Math.min(pageContent.length, matchIndex + 150);
        const relevantContext = pageContent.slice(contextStart, contextEnd);

        const result = {
          pageTitle: page.title,
          pageId: page.id,
          url: page._links.webui,
          relevantContext: relevantContext,
          message: `Found relevant information in page "${page.title}". The query "${query}" appears in this context: "...${relevantContext}..."`,
        };
        console.log("Found matching content:", result);
        return result;
      }
    }

    const notFoundMessage = `Could not find any information matching "${payload.query}". Please try rephrasing your query.`;
    console.log("No matching content found:", notFoundMessage);
    return { message: notFoundMessage };
  } catch (error) {
    console.error("Error searching for information:", error);
    return {
      message: `Error searching for information: ${error.message}`,
    };
  }
}
