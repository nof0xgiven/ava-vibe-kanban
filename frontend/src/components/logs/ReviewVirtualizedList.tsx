import {
  DataWithScrollModifier,
  ScrollModifier,
  VirtuosoMessageList,
  VirtuosoMessageListLicense,
  VirtuosoMessageListMethods,
  VirtuosoMessageListProps,
} from '@virtuoso.dev/message-list';
import { useEffect, useMemo, useRef, useState } from 'react';

import DisplayConversationEntry from '../NormalizedConversation/DisplayConversationEntry';
import { PatchType } from 'shared/types';
import { Loader2 } from 'lucide-react';
import { streamJsonPatchEntries } from '@/utils/streamJsonPatchEntries';

type PatchTypeWithKey = PatchType & {
  patchKey: string;
  executionProcessId: string;
};

interface ReviewVirtualizedListProps {
  processId: string;
}

const INITIAL_TOP_ITEM = { index: 'LAST' as const, align: 'end' as const };

const InitialDataScrollModifier: ScrollModifier = {
  type: 'item-location',
  location: INITIAL_TOP_ITEM,
  purgeItemSizes: true,
};

const AutoScrollToBottom: ScrollModifier = {
  type: 'auto-scroll-to-bottom',
  autoScroll: 'smooth',
};

const ItemContent: VirtuosoMessageListProps<
  PatchTypeWithKey,
  { processId: string }
>['ItemContent'] = ({ data }) => {
  if (data.type === 'STDOUT') {
    return <p className="px-4 py-1 text-sm">{data.content}</p>;
  }
  if (data.type === 'STDERR') {
    return <p className="px-4 py-1 text-sm text-destructive">{data.content}</p>;
  }
  if (data.type === 'NORMALIZED_ENTRY') {
    return (
      <DisplayConversationEntry
        expansionKey={data.patchKey}
        entry={data.content}
        executionProcessId={data.executionProcessId}
      />
    );
  }

  return null;
};

const computeItemKey: VirtuosoMessageListProps<
  PatchTypeWithKey,
  { processId: string }
>['computeItemKey'] = ({ data }) => `review-${data.patchKey}`;

const ReviewVirtualizedList = ({ processId }: ReviewVirtualizedListProps) => {
  const [channelData, setChannelData] =
    useState<DataWithScrollModifier<PatchTypeWithKey> | null>(null);
  const [loading, setLoading] = useState(true);
  const prevLengthRef = useRef(0);

  useEffect(() => {
    setLoading(true);
    setChannelData(null);
    prevLengthRef.current = 0;

    const url = `/api/execution-processes/${processId}/normalized-logs/ws`;

    const controller = streamJsonPatchEntries<PatchType>(url, {
      onEntries: (entries) => {
        const patchesWithKeys: PatchTypeWithKey[] = entries.map((entry, idx) => ({
          ...entry,
          patchKey: `${processId}:${idx}`,
          executionProcessId: processId,
        }));

        // Determine scroll behavior based on whether this is initial load or streaming
        const isInitialLoad = prevLengthRef.current === 0;
        const scrollModifier = isInitialLoad
          ? InitialDataScrollModifier
          : AutoScrollToBottom;

        prevLengthRef.current = entries.length;
        setChannelData({ data: patchesWithKeys, scrollModifier });
        setLoading(false);
      },
      onFinished: () => {
        setLoading(false);
      },
      onError: (err) => {
        console.warn(`Error loading review logs for process ${processId}`, err);
        setLoading(false);
      },
    });

    return () => {
      controller.close();
    };
  }, [processId]);

  const messageListRef = useRef<VirtuosoMessageListMethods | null>(null);
  const messageListContext = useMemo(() => ({ processId }), [processId]);

  return (
    <div className="h-full relative">
      <VirtuosoMessageListLicense
        licenseKey={import.meta.env.VITE_PUBLIC_REACT_VIRTUOSO_LICENSE_KEY}
      >
        <VirtuosoMessageList<PatchTypeWithKey, { processId: string }>
          ref={messageListRef}
          className="flex-1 h-full"
          data={channelData}
          initialLocation={INITIAL_TOP_ITEM}
          context={messageListContext}
          computeItemKey={computeItemKey}
          ItemContent={ItemContent}
          Header={() => <div className="h-2"></div>}
          Footer={() => <div className="h-2"></div>}
        />
      </VirtuosoMessageListLicense>
      {loading && !channelData && (
        <div className="absolute inset-0 bg-background flex flex-col gap-2 justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading Review...</p>
        </div>
      )}
    </div>
  );
};

export default ReviewVirtualizedList;
