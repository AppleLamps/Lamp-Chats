import { useCompletion } from '@ai-sdk/react';
import { useAPIKeyStore } from '@/frontend/stores/APIKeyStore';
import { toast } from 'sonner';
import { createMessageSummary, updateThread } from '@/frontend/dexie/queries';

interface MessageSummaryPayload {
  title: string;
  isTitle?: boolean;
  messageId: string;
  threadId: string;
}

export const useMessageSummary = () => {
  const getKey = useAPIKeyStore((state) => state.getKey);

  const { complete, isLoading } = useCompletion({
    api: '/api/completion',
    ...(getKey('google') && {
      headers: { 'X-Google-API-Key': getKey('google')! },
    }),
    onFinish: async () => {},
  });

  return {
    async complete(prompt: string, options?: any) {
      try {
        const serverTitle = await complete(prompt, options);
        const { isTitle, messageId, threadId } = (options?.body || {}) as Partial<MessageSummaryPayload>;

        if (!messageId || !threadId) {
          console.warn('Missing messageId/threadId for summary update', options?.body || {});
          return;
        }

        const trimmedServerTitle = typeof serverTitle === 'string' ? serverTitle.trim() : '';
        const fallbackTitle = prompt
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 80)
          .replace(/[\s\-_,.;:!?#]+$/g, '');
        const finalTitle = trimmedServerTitle || fallbackTitle;

        if (!finalTitle) {
          console.warn('No title generated and no fallback available');
          return;
        }

        if (isTitle) {
          await updateThread(threadId, finalTitle);
          await createMessageSummary(threadId, messageId, finalTitle);
        } else {
          await createMessageSummary(threadId, messageId, finalTitle);
        }
      } catch (error) {
        const { messageId, threadId, isTitle } = (options?.body || {}) as Partial<MessageSummaryPayload>;
        const fallbackTitle = prompt
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 80)
          .replace(/[\s\-_,.;:!?#]+$/g, '');

        if (messageId && threadId && fallbackTitle) {
          try {
            if (isTitle) {
              await updateThread(threadId, fallbackTitle);
            }
            await createMessageSummary(threadId, messageId, fallbackTitle);
          } catch (e) {
            console.error('Failed to store fallback summary:', e);
          }
        } else {
          console.error('Failed to complete summary and no fallback could be applied:', error);
          toast.error('Failed to generate a summary for the message');
        }
      }
    },
    isLoading,
  };
};
