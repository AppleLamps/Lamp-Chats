import { memo } from 'react';
import PreviewMessage from './Message';
import { UIMessage } from 'ai';
import { UseChatHelpers } from '@ai-sdk/react';
import equal from 'fast-deep-equal';
import MessageLoading from './ui/MessageLoading';
import Error from './Error';
import { MessageSkeletonList } from './ui/MessageSkeleton';

function PureMessages({
  threadId,
  messages,
  status,
  setMessages,
  regenerate,
  error,
  stop,
  registerRef,
}: {
  threadId: string;
  messages: UIMessage[];
  setMessages: UseChatHelpers<UIMessage>['setMessages'];
  regenerate: UseChatHelpers<UIMessage>['regenerate'];
  status: UseChatHelpers<UIMessage>['status'];
  error: UseChatHelpers<UIMessage>['error'];
  stop: UseChatHelpers<UIMessage>['stop'];
  registerRef: (id: string, ref: HTMLDivElement | null) => void;
}) {

  return (
    <section className="flex flex-col space-y-12">
      {messages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          threadId={threadId}
          message={message}
          isStreaming={status === 'streaming' && messages.length - 1 === index}
          setMessages={setMessages}
          reload={regenerate}
          registerRef={registerRef}
          stop={stop}
        />
      ))}
      {status === 'submitted' && <MessageLoading />}
      {error && <Error message={error.message} />}
    </section>
  );
}

const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.error !== nextProps.error) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  return true;
});

Messages.displayName = 'Messages';

export default Messages;
