import { useChat, UseChatHelpers, useCompletion } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import Messages from './Messages';
import ChatInput from './ChatInput';
import ChatNavigator from './ChatNavigator';
import { v4 as uuidv4 } from 'uuid';
import { createMessage, createThread } from '@/frontend/dexie/queries';
import { useAPIKeyStore } from '@/frontend/stores/APIKeyStore';
import { useModelStore } from '@/frontend/stores/ModelStore';
import ThemeToggler from './ui/ThemeToggler';
import { SidebarTrigger, useSidebar } from './ui/sidebar';
import { Button } from './ui/button';
import { MessageSquareMore } from 'lucide-react';
import { useChatNavigator } from '@/frontend/hooks/useChatNavigator';
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface ChatProps {
  threadId: string;
  initialMessages: UIMessage[];
}

export default function Chat({ threadId, initialMessages }: ChatProps) {
  const { getKey } = useAPIKeyStore();
  const selectedModel = useModelStore((state) => state.selectedModel);
  const modelConfig = useModelStore((state) => state.getModelConfig());
  const [input, setInput] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const {
    isNavigatorVisible,
    handleToggleNavigator,
    closeNavigator,
    registerRef,
    scrollToMessage,
  } = useChatNavigator();

  const initialMessagesRef = useRef(initialMessages);
  const { complete } = useCompletion();

  const {
    messages,
    status,
    setMessages,
    stop,
    regenerate,
    sendMessage,
    error,
  } = useChat<UIMessage>({
    id: threadId,
    messages: initialMessagesRef.current,
    experimental_throttle: 50,
    onFinish: async ({ message }) => {
      const aiMessage = {
        id: message.id || uuidv4(),
        parts: message.parts as UIMessage['parts'],
        role: 'assistant' as const,
        createdAt: new Date(),
      } as any;
      try {
        await createMessage(threadId, aiMessage as UIMessage);
      } catch (error) {
        console.error(error);
      }
    },
    transport: new DefaultChatTransport({
      api: '/api/chat',
      headers: () => ({ [modelConfig.headerKey]: getKey(modelConfig.provider) || '' }),
      body: () => ({ model: selectedModel }),
    }),
  });

  useEffect(() => {
    const handleInitialMessage = async () => {
      if (location.state?.userMessage) {
        const userMessage = location.state.userMessage as UIMessage;

        await createThread(threadId);
        await createMessage(threadId, userMessage);

        sendMessage(userMessage);

        const textContent = userMessage.parts.find(p => p.type === 'text' && 'text' in p) as { type: 'text', text: string } | undefined;
        if (textContent) {
          complete(textContent.text.trim(), {
            body: { threadId, messageId: userMessage.id, isTitle: true },
          });
        }

        navigate(location.pathname, { replace: true, state: {} });
      }
    };

    handleInitialMessage();
  }, [location.state, threadId, sendMessage, complete, navigate]);

  return (
    <div className="relative w-full">
      <ChatSidebarTrigger />
      <main
        className={`flex flex-col w-full max-w-3xl pt-20 pb-44 mx-auto px-4 sm:px-0 transition-all duration-300 ease-in-out`}
      >
        <Messages
          threadId={threadId}
          messages={messages}
          status={status}
          setMessages={setMessages}
          regenerate={regenerate}
          error={error}
          registerRef={registerRef}
          stop={stop}
        />
        <ChatInput
          threadId={threadId}
          input={input}
          status={status}
          sendMessage={sendMessage}
          setInput={setInput}
          stop={stop}
        />
      </main>
      <ThemeToggler />
      <Button
        onClick={handleToggleNavigator}
        variant="outline"
        size="icon"
        className="fixed right-16 top-4 z-20"
        aria-label={
          isNavigatorVisible
            ? 'Hide message navigator'
            : 'Show message navigator'
        }
      >
        <MessageSquareMore className="h-5 w-5" />
      </Button>

      <ChatNavigator
        threadId={threadId}
        scrollToMessage={scrollToMessage}
        isVisible={isNavigatorVisible}
        onClose={closeNavigator}
      />
    </div>
  );
}

const ChatSidebarTrigger = () => {
  const { state } = useSidebar();
  if (state === 'collapsed') {
    return <SidebarTrigger className="fixed left-4 top-4 z-100" />;
  }
  return null;
};
