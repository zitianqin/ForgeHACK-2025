import api, { route } from "@forge/api";

export async function findInfoInPage(payload) {
  const { query, pageContent, pageTitle } = payload;
  console.log(`Analyzing page content for query: ${query}`);

  // Use the page analyzer agent to determine if the page contains an answer
  // Look for query keywords in content and extract relevant information
  if (pageContent.toLowerCase().includes(query.toLowerCase())) {
    const matchIndex = pageContent.toLowerCase().indexOf(query.toLowerCase());
    const contextStart = Math.max(0, matchIndex - 150);
    const contextEnd = Math.min(pageContent.length, matchIndex + 150);
    const relevantContext = pageContent.slice(contextStart, contextEnd);

    console.log(
      `Found relevant information in page "${pageTitle}": ${relevantContext}`
    );

    return {
      found: true,
      answer: relevantContext,
      confidence: "high",
      context: `Found in section: "${relevantContext}"`,
    };
  }

  console.log(`No relevant information found in page "${pageTitle}"`);

  return {
    found: false,
    answer: undefined,
    confidence: "none",
    context: `No relevant information found in page "${pageTitle}"`,
  };
}

/**
 * Convert space-separated keywords to an array
 * @param {*} spaceSeparatedKeywords - Space-separated keywords
 * @returns {Array} - Array of keywords
 */
export async function spaceSeparatedToArray(spaceSeparatedKeywords) {
  console.log(
    `Converting space-separated keywords to array: ${spaceSeparatedKeywords}`
  );
  return spaceSeparatedKeywords.toLowerCase().split(" ").join(" ");
}

export async function deepSearch(payload, context) {
  const query = payload.query.toLowerCase();
  console.log(`Searching Confluence for query: ${query}`);

  try {
    // Get keywords from query using the keywords agent
    const keywords = await context.invoke("get-keywords-from-query", { query });
    console.log(`Extracted keywords: ${keywords}`);

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

      // Use findInfoInPage to analyze the page content
      const pageAnalysis = await context.invoke("find-info-in-page", {
        query: keywords,
        pageContent: pageContent,
        pageTitle: page.title,
      });

      if (pageAnalysis.found) {
        const result = {
          pageTitle: page.title,
          pageId: page.id,
          url: page._links.webui,
          answer: pageAnalysis.answer,
          confidence: pageAnalysis.confidence,
          message: `Found relevant information in page "${page.title}". ${pageAnalysis.context}`,
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
