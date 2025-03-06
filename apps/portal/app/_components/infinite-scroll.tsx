import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";

interface InfiniteScrollProps {
  onLoadMore: () => void;
  hasMore: boolean;
}

export function InfiniteScroll({ onLoadMore, hasMore }: InfiniteScrollProps) {
  const { ref, inView } = useInView();
  const prevInView = useRef(false);

  useEffect(() => {
    if (inView && !prevInView.current && hasMore) {
      onLoadMore();
    }
    prevInView.current = inView;
  }, [inView, onLoadMore, hasMore]);

  return (
    <div ref={ref} className="flex items-center justify-center gap-4">
      {hasMore && (
        <>
          <Loader2 className="animate-spin" />
          <p className="text-muted-foreground">Loading more...</p>
        </>
      )}
    </div>
  );
}
