import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import axios from'axios';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const ACCESS_KEY = "783100bb-8615-439e-916e-24c3a7ccd32d"
const DEVELOPER_ID = "56956d93-73d0-4313-a245-9e9eb9d13190"
const SIGNING_SECRET = "71zEFoQQbZnVwZprLJwQpbVxY7b35tA2B4DFQSg1TT8"

export async function order(payload) {
  console.log(payload);

  const accessKey = {
    developer_id: DEVELOPER_ID,
    key_id: ACCESS_KEY,
    signing_secret: SIGNING_SECRET
  }
  
  const data = {
    aud: 'doordash',
    iss: accessKey.developer_id,
    kid: accessKey.key_id,
    exp: Math.floor(Date.now() / 1000 + 300),
    iat: Math.floor(Date.now() / 1000),
  }
  
  const headers = { algorithm: 'HS256', header: { 'dd-ver': 'DD-JWT-V1' } }
  
  const token = jwt.sign(
    data,
    Buffer.from(accessKey.signing_secret, 'base64'),
    headers,
  )
  
  console.log(token)
  
  let str = uuidv4();
  console.log(uuidv4());
  const body = JSON.stringify({
    external_delivery_id: str,
    pickup_address: '901 Market Street 6th Floor San Francisco, CA 94103',
    pickup_business_name: 'Wells Fargo SF Downtown',
    pickup_phone_number: '+16505555555',
    pickup_instructions: 'Enter gate code 1234 on the callbox.',
    dropoff_address: '901 Market Street 6th Floor San Francisco, CA 94103',
    dropoff_business_name: 'Wells Fargo SF Downtown',
    dropoff_phone_number: '+16505555555',
    dropoff_instructions: 'Enter gate code 1234 on the callbox.',
    order_value: 1999,
  })
  
  // axios
  //   .post('https://openapi.doordash.com/drive/v2/deliveries', body, {
  //     headers: {
  //       Authorization: 'Bearer ' + token,
  //       'Content-Type': 'application/json',
  //     },
  //   })
  //   .then(function (response) {
  //     console.log(response.data)
  //   })
  //   .catch(function (error) {
  //     console.log(error)
  //   })
  
  // await axios
  //   .post('https://openapi.doordash.com/drive/v2/deliveries', body, {
  //     headers: {
  //       Authorization: `Bearer ${token}`,
  //       "Content-Type": "application/json",
  //     },
  //     validateStatus: false, // Allows us to capture the full error response
  //   })
  //   .then((response) => {
  //     if (response.status === 400) {
  //       console.error("🚨 Validation Error:", response.data);
  //     } else {
        
  //       console.log("✅ Success:", response.data);
  //       const ans = response.data.tracking_url;
  //       console.log(ans);
  //       return {tracking_url: ans};
  //     }
  //   })
  //   .catch((error) => {
  //     console.error("❌ Error Response:", error.response ? error.response.data : error.message);
  //   });
  const response = await axios.post(
    "https://openapi.doordash.com/drive/v2/deliveries",
    body,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      validateStatus: false, // Capture error responses
    }
  );

  if (response.status === 400) {
    console.error("🚨 Validation Error:", response.data);
    return { error: "Validation failed", details: response.data };
  } else {
    console.log("✅ Success:", response.data);
    return { tracking_url: response.data.tracking_url };
  }
// } catch (error) {
//   console.error("❌ Error:", error.response ? error.response.data : error.message);
//   return { error: "Failed to place order", details: error.message };
// }
}
order({});








// import api, { route } from '@forge/api';

// const addJiraCommentInternal = async (issueId, commentText) => {
//   try {
//     const bodyData = {
//       body: {
//         type: "doc",
//         version: 1,
//         content: [
//           {
//             type: "paragraph",
//             content: [{
//               text: commentText,
//               type: "text"
//             }]
//           }
//         ]
//       }
//     };
//     const response = await api.asUser().requestJira(route`/rest/api/3/issue/${issueId}/comment`, {
//       method: 'POST',
//       headers: {
//         'Accept': 'application/json',
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify(bodyData)
//     });

//     if(response.ok){
//       console.log(`Added comment '${commentText}' to issueId: ${issueId}`);
//     }
//     else{
//       console.log(`Failed to add comment '${commentText}' '${await response.text()}' to issueId: ${issueId}`);
//     }
//   }
//   catch(error){
//     console.log(error);
//   }
// };

// export async function addComment(payload) {
//   const issueId = payload.issueId;
//   const comment = payload.comment;

//   await addJiraCommentInternal(issueId, comment);
// }

// export async function fetchComments(payload) {
//   const issueId = payload.issueId;
//   const response = await api.asUser().requestJira(route`/rest/api/3/issue/${issueId}/comment`, {
//     headers: {
//       'Accept': 'application/json'
//     }
//   });
//   return response.json();
// }
