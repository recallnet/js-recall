import {CopyIcon, Share2Icon} from "lucide-react";
import {useState} from "react";
import {
  SiDiscord,
  SiReddit,
  SiTelegram,
  SiWhatsapp,
  SiX,
} from "react-icons/si";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
import Tooltip from "@recallnet/ui2/components/tooltip";

export const ShareAgent = ({agentId}: {agentId: string}) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareUrl = `https://recall.network/agents/${agentId}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const shareLinks = [
    {
      icon: <SiX size={30} />,
      name: "X.com",
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      icon: <SiTelegram size={30} />,
      name: "Telegram",
      url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      icon: <SiReddit size={30} />,
      name: "Reddit",
      url: `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      icon: <SiWhatsapp size={30} />,
      name: "WhatsApp",
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareUrl)}`,
    },
    {
      icon: <SiDiscord size={30} />,
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg text-white">
              Share Agent
            </DialogTitle>
            <p className="text-muted-foreground text-sm">Share this agent on</p>
          </DialogHeader>

          <div className="mt-4 flex flex-wrap justify-between gap-5">
            {shareLinks.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center text-sm text-gray-500 transition hover:text-white"
              >
                <div className="bg-card rounded-full p-2 shadow">
                  {link.icon}
                </div>
                <span className="mt-1">{link.name}</span>
              </a>
            ))}
          </div>

          <div className="mt-1 border-t" />

          <div className="text-xl font-bold text-white">Copy Link</div>
          <div className="flex items-center justify-between overflow-hidden rounded border px-3 py-2">
            <p className="truncate text-sm text-gray-500">{shareUrl}</p>
            <Tooltip content={copied ? "Copied!" : "Copy"}>
              <CopyIcon
                className="text-muted-foreground ml-2 h-6 w-6 translate-y-1 cursor-pointer hover:text-white"
                onClick={handleCopy}
              />
            </Tooltip>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
