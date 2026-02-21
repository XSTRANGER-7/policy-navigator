export async function callCitizenAgent(payload: any) {
  const res = await fetch(process.env.N8N_CITIZEN_WEBHOOK!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    console.error("Failed to call Citizen Agent")
  }
}