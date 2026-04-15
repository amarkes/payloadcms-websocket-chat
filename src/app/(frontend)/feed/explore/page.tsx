import { redirect } from 'next/navigation'

interface LegacyExplorePageProps {
  searchParams: Promise<{ tag?: string }>
}

export default async function LegacyExplorePage({ searchParams }: LegacyExplorePageProps) {
  const { tag } = await searchParams
  redirect(tag ? `/explore?tag=${encodeURIComponent(tag)}` : '/explore')
}
