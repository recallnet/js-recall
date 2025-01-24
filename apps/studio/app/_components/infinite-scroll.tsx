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
    <div ref={ref} className="h-10">
      {hasMore && <div className="text-center py-4">Loading more...</div>}
    </div>
  );
}
