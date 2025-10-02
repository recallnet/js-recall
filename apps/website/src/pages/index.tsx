import { Layout } from "../components/Layout";
import data from "../data/home.json";
import { fetchRSSNews } from "../lib/fetch-rss-news";
import { HomePageData, NewsBlockType, Section } from "../types/components";

interface HomeProps {
  data: HomePageData;
}

export default function Home({ data }: HomeProps) {
  return <Layout data={data} />;
}

export async function getStaticProps() {
  try {
    // Fetch RSS news
    const rssNews = await fetchRSSNews(
      "https://api.paragraph.com/blogs/rss/%40recall",
      4,
    );

    // Deep clone the data to avoid mutating the imported object
    const modifiedData = JSON.parse(JSON.stringify(data)) as HomePageData;

    // Find the newsBlock section and update its news array
    const sections = modifiedData.sections;
    const newsBlockIndex = sections.findIndex(
      (section) => section._type === "newsBlock",
    );

    if (newsBlockIndex !== -1 && rssNews.length > 0) {
      // Replace the static news with RSS feed news
      // Type assertion is safe here as we've checked the _type is 'newsBlock'
      (sections[newsBlockIndex] as unknown as NewsBlockType & Section).news =
        rssNews;
    }

    return {
      props: {
        data: modifiedData,
      },
      revalidate: 300, // Revalidate every 5 minutes
    };
  } catch (error) {
    console.error("Error fetching homepage data:", error);

    return {
      props: {
        data: data as HomePageData, // Fallback to static data
      },
      revalidate: 60,
    };
  }
}
