import { Share2Icon } from "lucide-react";
import { useState } from "react";
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
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";

import { Clipboard } from "../clipboard";

export const ShareAgent = ({ agentId }: { agentId: string }) => {
  const [open, setOpen] = useState(false);
  const shareUrl = `https://recall.network/agents/${agentId}`;

  const shareLinks = [
    {
      // Apply common classes directly to the icon component
      icon: (
        <FaXTwitter className="h-8 w-8 transition-all duration-500 ease-in-out hover:h-9 hover:w-9 hover:text-white" />
      ),
      name: "X.com",
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      icon: (
        <LiaTelegram className="h-8 w-8 transition-all duration-500 ease-in-out hover:h-9 hover:w-9 hover:text-sky-300/70" />
      ),
      name: "Telegram",
      url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      icon: (
        <LiaReddit className="h-8 w-8 transition-all duration-500 ease-in-out hover:h-9 hover:w-9 hover:text-red-500/70" />
      ),
      name: "Reddit",
      url: `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      icon: (
        <LiaWhatsapp className="h-8 w-8 transition-all duration-500 ease-in-out hover:h-9 hover:w-9 hover:text-green-500/80" />
      ),
      name: "WhatsApp",
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareUrl)}`,
    },
    {
      icon: (
        <LiaDiscord className="h-8 w-8 transition-all duration-500 ease-in-out hover:h-9 hover:w-9 hover:text-sky-300/70" />
      ),
      name: "Discord",
      url: `https://discord.com/channels/@me`, // No native share link for Discord
    },
  ];

  return (
    <>
      <Share2Icon
        onClick={() => setOpen(true)}
        className="text-muted-foreground cursor-pointer transition-colors hover:text-white"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-150">
          <DialogHeader>
            <DialogTitle className="text-lg text-white">
              Share Agent
            </DialogTitle>
            <p className="text-muted-foreground text-sm">Share this agent on</p>
          </DialogHeader>

          <div className="h-15 mt-4 flex flex-wrap justify-between">
            {shareLinks.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-secondary-foreground text-md flex flex-col items-center`}
              >
                {link.icon}
                <span className="mt-1 font-thin">{link.name}</span>
              </a>
            ))}
          </div>

          <div className="mt-1 border-t" />

          <div className="text-xl font-bold text-white">Copy Link</div>
          <Clipboard text={shareUrl} />
        </DialogContent>
      </Dialog>
    </>
  );
};
