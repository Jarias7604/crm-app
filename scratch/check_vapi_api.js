const apiKey = "15bc32d6-8c43-4f55-9e4a-5d7db558e2f5";

async function run() {
  console.log("Fetching Phone Numbers from Vapi...");
  const res = await fetch("https://api.vapi.ai/phone-number", {
    headers: {
      "Authorization": `Bearer ${apiKey}`
    }
  });

  if (!res.ok) {
    console.error("Vapi Error:", await res.text());
    return;
  }

  const phoneNumbers = await res.json();
  console.log("Registered Phone Numbers:");
  console.log(JSON.stringify(phoneNumbers, null, 2));
}

run().catch(console.error);
