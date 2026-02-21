"use client"

import { useState } from "react"
import VCBadge from "@/components/VCBadge"

export default function Dashboard() {
  const [citizenId, setCitizenId] = useState("")
  const [vc, setVc] = useState(null)

  async function fetchVC() {
    const res = await fetch(`/api/vc?citizenId=${citizenId}`)
    const data = await res.json()
    setVc(data.vc)
  }

  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold mb-4">Check Your Credential</h1>

      <input
        className="border p-2 mr-2"
        placeholder="Enter Citizen ID"
        onChange={e => setCitizenId(e.target.value)}
      />

      <button
        onClick={fetchVC}
        className="bg-green-600 text-white px-4 py-2 rounded"
      >
        Fetch VC
      </button>

      <VCBadge vc={vc} />
    </main>
  )
}