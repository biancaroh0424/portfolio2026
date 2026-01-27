import { getResume } from '@/lib/data'

export default async function ResumePage() {
  const resume = await getResume()

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-8 text-black">Resumé</h1>
        {resume && resume.content ? (
          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: resume.content }}
          />
        ) : (
          <p className="text-gray-600">Resume content will be added here.</p>
        )}
      </div>
    </div>
  )
}

