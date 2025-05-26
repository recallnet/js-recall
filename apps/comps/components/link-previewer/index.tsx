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
      className="flex flex-col justify-between w-80 h-110 border border-gray-400 bg-white transition"
    >
      <div className="p-6 flex flex-col w-full">
        {image && (
          <div className="relative h-40 w-full flex-shrink-0 rounded-t-lg mb-4">
            <Image
              src={image}
              alt={title}
              fill
              className="object-cover"
            />
          </div>
        )}

        <div className="flex flex-col flex-grow justify-between">
          <div className="flex-grow">
            <p className="text-gray-500 font-semibold">{title}</p>
            {description && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2 relative max-h-10 overflow-hidden">
                <span className="absolute bottom-0 left-0 w-full h-4 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                {description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-300 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200">
            <Image src={siteIcon} alt="Site logo" width={28} height={28} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-gray-700 font-medium">{siteHandle}</span>
            <span className="text-xs text-gray-400">{date}</span>
          </div>
        </div>
      </div>
    </a>
  );
};

