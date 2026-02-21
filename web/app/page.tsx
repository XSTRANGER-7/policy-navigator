import CitizenForm from "@/components/CitizenForm"

export default function Home() {
  return (
    <main className="p-10 min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">Policy Navigator</h1>
      <CitizenForm />
    </main>
  )
}