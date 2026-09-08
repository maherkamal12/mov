import MovieWatchClient from "./MovieWatchClient";

interface PageProps {
  params: Promise<{ vid: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { vid } = await params;
  return {
    title: `مشاهدة فيلم - سينمافlix`,
    description: `مشاهدة فيلم اون لاين بجودة عالية HD`,
  };
}

export default async function MovieWatchPage({ params }: PageProps) {
  const { vid } = await params;
  return <MovieWatchClient vid={vid} />;
}
