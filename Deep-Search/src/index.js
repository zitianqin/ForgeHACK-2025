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

async function analyseContent(query, pageContent) {
  const prompt = `
    Analyze if this content answers or partially answers the query: "${query}"
    
    Content: """
    ${pageContent}
    """

    Note that if the user is asking for contact information, Slack, Instagram, Facebook, email, phone etc. are all ways of contacting someone.
    
    Return ONLY a JSON object with this format:
    {
      "isMatch": boolean,
      "relevantText": string or null,
      "confidence": number between 0-1
    }
    `;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "mixtral-8x7b-32768",
    temperature: 0.1,
  });

  return JSON.parse(completion.choices[0].message.content);
}

function cleanStyleTags(content) {
  // Remove common style-related tags while preserving their content
  const styleTags = [
    "strong",
    "b",
    "i",
    "em",
    "italic",
    "bold",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "u",
    "strike",
    "style",
    "span",
    "font",
    "color",
    "align",
    "center",
  ];

  let cleanText = content;

  // Create regex pattern for opening and closing tags
  styleTags.forEach((tag) => {
    // Remove opening tags with any attributes
    cleanText = cleanText.replace(new RegExp(`<${tag}[^>]*>`, "gi"), "");
    // Remove closing tags
    cleanText = cleanText.replace(new RegExp(`</${tag}>`, "gi"), "");
  });

  // Remove style attributes from remaining tags
  cleanText = cleanText.replace(/\s*style="[^"]*"/gi, "");

  return cleanText;
}

export async function deepSearch(payload) {
  const query = payload.query;
  console.log(`Searching Confluence for query: ${query}`);

  const results = [];

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
      const pageContent = cleanStyleTags(content.body.storage.value);
      console.log(`Page content: ${pageContent}`);

      // Look for if any of the keywords is in content
      if (
        keywords.split(" ").some((keyword) => pageContent.includes(keyword))
      ) {
        // Analyse content with LLM
        const analysis = await analyseContent(query, pageContent);

        if (analysis.isMatch) {
          results.push({
            pageTitle: page.title,
            pageId: page.id,
            url: page._links.webui,
            relevantText: analysis.relevantText,
            confidence: analysis.confidence,
          });
        }
      }
    }

    if (results.length > 0) {
      // Sort results by confidence
      results.sort((a, b) => b.confidence - a.confidence);
      return {
        matches: results,
        message: `Found ${results.length} relevant pages. Results are sorted by confidence.`,
      };
    }

    return {
      matches: [],
      message: `Could not find any information matching "${payload.query}". Please try rephrasing your query.`,
    };
  } catch (error) {
    console.error("Error searching for information:", error);
    return {
      matches: [],
      message: `Error searching for information: ${error.message}`,
    };
  }
}
