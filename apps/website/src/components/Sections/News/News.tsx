import { motion, useInView } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";

import { SectionTitle } from "@/components/Common/SectionTitle";
import { NewsBlockType } from "@/types/components";
import { NewsType } from "@/types/components";

// Create a separate type for the Item component without requiring _id and _type
type ItemProps = Omit<NewsType, "_id" | "_type"> & {
  key?: string;
};

const Item = ({
  image,
  text,
  source,
  meta: { date, image: metaImage, title },
}: ItemProps) => {
  const formattedText = text.replace(/\n/g, "<br />");

  return (
    <Link
      href={source}
      className="flex shrink-0 flex-col border border-[#C3CAD2] max-lg:w-[calc(25%_-_10px)] max-lg:min-w-[160px]"
      target="_blank"
    >
      <div className="relative pl-[10px] pr-[6px] pt-[10px] lg:p-5 lg:pb-0">
        <div className="h-[196px] overflow-hidden lg:h-[284px]">
          {image && (
            <div className="relative mb-2 h-[130px] w-full overflow-hidden rounded-[4px]">
              <Image
                src={image.url + "?w=426&auto=format"}
                width={image.width}
                height={image.height}
                alt="News"
                className="absolute left-0 top-0 h-full w-full object-cover"
              />
            </div>
          )}
          <div className="absolute bottom-0 left-0 z-10 h-[100px] w-full bg-gradient-to-t from-[#F4F4F4] to-[#F4F4F4]/0" />

          <p
            className="text-[15px] leading-[19px] tracking-[0.32px] text-[#1D1F2B] lg:text-[16px] lg:leading-[20px]"
            dangerouslySetInnerHTML={{ __html: formattedText }}
          />
        </div>
      </div>

      <div className="flex h-[48px] flex-row items-center gap-3 border-t border-[#C3CAD2] px-3 lg:h-[72px] lg:px-5">
        <div className="aspect-square w-[26px] overflow-hidden rounded-full bg-white lg:w-9">
          <Image
            src={metaImage.url + "?w=72&auto=format"}
            alt="Twitter"
            width="72"
            height="72"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex flex-col lg:gap-0.5">
          <span className="text-[15px] tracking-[0.32px] text-[#1D1F2B] lg:text-[16px] lg:leading-[20px]">
            {title}
          </span>
          <span className="text-mutedLight text-[12px] leading-[15px] tracking-[0.42px] max-lg:-mt-0.5 lg:text-[14px] lg:leading-[18px]">
            {date}
          </span>
        </div>
      </div>
    </Link>
  );
};

export const News = ({ node }: { node: NewsBlockType }) => {
  const { heading, news } = node;

  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, {
    once: true,
    amount: 0.5,
  });

  return (
    <section
      className="flex w-full flex-col items-center justify-center bg-[#F4F4F4] pt-[120px] lg:pb-[164px] lg:pt-[180px]"
      ref={ref}
    >
      <div className="w-full max-w-[1140px]">
        <SectionTitle title={heading} isInView={isInView} />
      </div>

      <motion.div
        className="flex w-full max-w-[1140px] flex-col gap-[18px] lg:gap-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 10 }}
        transition={{ duration: 0.5 }}
      >
        <div className="border-foreground/10 mx-5 border-t lg:mx-0" />
        <div className="flex w-full flex-row gap-[10px] max-lg:overflow-x-scroll max-lg:px-5 lg:grid lg:grid-cols-4 lg:gap-10">
          {news.map((item) => (
            <Item
              key={item._id}
              text={item.text}
              image={item.image}
              source={item.source}
              meta={item.meta}
            />
          ))}
        </div>
      </motion.div>
    </section>
  );
};
