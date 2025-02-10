import api, { route } from "@forge/api";

export async function findSlackChannel(payload) {
  console.log(`Logging message: ${payload.teamName}`);

  const response = await api
    .asUser()
    .requestConfluence(route`/wiki/api/v2/pages`, {
      headers: {
        Accept: "application/json",
      },
    });

  console.log(`Response: ${response.status} ${response.statusText}`);
  console.log(await response.json());
}
