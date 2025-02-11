import api, { route } from "@forge/api";

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
      const pageContent = content.body.storage.value.toLowerCase();

      // Look for query matches in content
      if (pageContent.includes(query)) {
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
          message: `Found relevant information in page "${page.title}". The query "${payload.query}" appears in this context: "...${relevantContext}..."`,
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
