import { LucideProps, Share2Icon } from "lucide-react";
import { ReactNode, useState } from "react";
import { FaXTwitter } from "react-icons/fa6";
import {
  LiaDiscord,
  LiaReddit,
  LiaTelegram,
  LiaWhatsapp,
} from "react-icons/lia";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
import { cn } from "@recallnet/ui2/lib/utils";

import { Clipboard } from "@/components/clipboard";

type Props = LucideProps & {
  url: string;
  title: ReactNode;
  subtitle?: ReactNode;
};

export const ShareModal: React.FunctionComponent<Props> = ({
  url,
  title,
  subtitle,
  className,
  ...rest
}) => {
  const [open, setOpen] = useState(false);

  const shareLinks = [
    {
      icon: (
        <FaXTwitter className="h-8 w-8 transition-all duration-500 ease-in-out group-hover:h-9 group-hover:w-9 group-hover:text-white" />
      ),
      name: "X.com",
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`,
    },
    {
      icon: (
        <LiaTelegram className="h-8 w-8 transition-all duration-500 ease-in-out group-hover:h-9 group-hover:w-9 group-hover:text-sky-300/70" />
      ),
      name: "Telegram",
      url: `https://t.me/share/url?url=${encodeURIComponent(url)}`,
    },
    {
      icon: (
        <LiaReddit className="h-8 w-8 transition-all duration-500 ease-in-out group-hover:h-9 group-hover:w-9 group-hover:text-red-500/70" />
      ),
      name: "Reddit",
      url: `https://www.reddit.com/submit?url=${encodeURIComponent(url)}`,
    },
    {
      icon: (
        <LiaWhatsapp className="h-8 w-8 transition-all duration-500 ease-in-out group-hover:h-9 group-hover:w-9 group-hover:text-green-500/80" />
      ),
      name: "WhatsApp",
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`,
    },
    {
      icon: (
        <LiaDiscord className="h-8 w-8 transition-all duration-500 ease-in-out group-hover:h-9 group-hover:w-9 group-hover:text-sky-300/70" />
      ),
      name: "Discord",
      url: `https://discord.com/channels/@me`, // No native share link for Discord
    },
  ];

  return (
    <>
      <Share2Icon
        onClick={() => setOpen(true)}
        className={cn(
          "text-muted-foreground cursor-pointer transition-colors hover:text-white",
          className,
        )}
        {...rest}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby="share-modal"
          className="max-w-150 w-full"
        >
          <DialogDescription className="hidden"></DialogDescription>
          <DialogHeader>
            <DialogTitle className="text-lg text-white">{title}</DialogTitle>
            {subtitle && subtitle}
          </DialogHeader>

          <div className="min-h-15 mt-4 flex w-full flex-wrap justify-between">
            {shareLinks.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-secondary-foreground text-md group flex flex-col items-center`}
              >
                {link.icon}
                <span className="mt-1 font-thin">{link.name}</span>
              </a>
            ))}
          </div>

          <div className="mt-1 border-t" />

          <div className="text-md font-semibold text-white">Copy Link</div>
          <Clipboard text={url} className="w-full" />
        </DialogContent>
      </Dialog>
    </>
  );
};
