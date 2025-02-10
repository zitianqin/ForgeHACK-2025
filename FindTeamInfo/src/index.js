import api, { route } from "@forge/api";

export async function findSlackChannel(payload) {
  const teamName = payload.teamName.toLowerCase();
  console.log(`Searching for Slack channel for team: ${teamName}`);

  try {
    // Get all Confluence pages
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

    // Log the entire pages response
    console.log("All pages data:", JSON.stringify(data, null, 2));

    // Search through pages for team information
    for (const page of data.results) {
      console.log("Processing page:", {
        id: page.id,
        title: page.title,
        url: page._links.webui,
      });

      // Get page content
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

      console.log("Page content:", {
        pageId: page.id,
        title: page.title,
        contentLength: content.body.storage.value.length,
        content: content,
        pageContent: pageContent,
      });

      // Look for team name and slack references
      if (
        pageContent.includes(teamName) &&
        (pageContent.includes("slack") || pageContent.includes("channel"))
      ) {
        const result = {
          pageTitle: page.title,
          pageId: page.id,
          url: page._links.webui,
          message: `Found team information in page "${page.title}". Please check the page for Slack channel details.`,
        };
        console.log("Found matching page:", result);
        return result;
      }
    }

    const notFoundMessage = `Could not find Slack channel information for team "${payload.teamName}". Please try with a different team name or check the team directory.`;
    console.log("No matching pages found:", notFoundMessage);
    return { message: notFoundMessage };
  } catch (error) {
    console.error("Error searching for team information:", error);
    return {
      message: `Error searching for team information: ${error.message}`,
    };
  }
}
