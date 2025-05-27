import Image from "next/image";

type LinkPreviewProps = {
  url: string;
  title: string;
  description?: string;
  image?: string;
  siteIcon?: string;
  siteHandle?: string;
  date?: string;
};

export const LinkPreview: React.FC<LinkPreviewProps> = ({
  url,
  title,
  description,
  image,
  siteIcon = "/favicon.ico", // fallback logo
  siteHandle = "@recallnet",
  date = "May 23, 2025",
}) => {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="h-110 flex w-80 flex-col justify-between border border-gray-400 bg-white transition"
    >
      <div className="flex w-full flex-col p-6">
        {image && (
          <div className="relative mb-4 h-40 w-full flex-shrink-0 rounded-t-lg">
            <Image src={image} alt={title} fill className="object-cover" />
          </div>
        )}

        <div className="flex flex-grow flex-col justify-between">
          <div className="flex-grow">
            <p className="font-semibold text-gray-500">{title}</p>
            {description && (
              <p className="relative mt-1 line-clamp-2 max-h-10 overflow-hidden text-sm text-gray-400">
                <span className="pointer-events-none absolute bottom-0 left-0 h-4 w-full bg-gradient-to-t from-white to-transparent" />
                {description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-300 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 overflow-hidden rounded-full bg-gray-200">
            <Image src={siteIcon} alt="Site logo" width={28} height={28} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-700">
              {siteHandle}
            </span>
            <span className="text-xs text-gray-400">{date}</span>
          </div>
        </div>
      </div>
    </a>
  );
};
