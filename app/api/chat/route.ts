
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, smoothStream, convertToModelMessages, UIMessage } from 'ai';
import { headers } from 'next/headers';
import { getModelConfig, AIModel } from '@/lib/models';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages, model } = await req.json();
    const headersList = await headers();

    console.log('=== API ROUTE DEBUG ===');
    console.log('Model:', model);
    console.log('Raw messages received:', JSON.stringify(messages, null, 2));

    const modelConfig = getModelConfig(model as AIModel);
    if (!modelConfig) {
      return new NextResponse(
        JSON.stringify({ error: 'Unknown or unsupported model', received: model }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    const apiKey = headersList.get(modelConfig.headerKey) as string;

    if (!apiKey) {
      return new NextResponse(
        JSON.stringify({ error: 'API key not found' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Messages are expected to be in UIMessage format from the client
    console.log('Final messages for AI:', JSON.stringify(messages, null, 2));

    let aiModel;
    switch (modelConfig.provider) {
      case 'google':
        const google = createGoogleGenerativeAI({ apiKey });
        aiModel = google(modelConfig.modelId);
        break;

      case 'openai':
        const openai = createOpenAI({ apiKey });
        aiModel = openai(modelConfig.modelId);
        break;

      case 'openrouter':
        const openrouter = createOpenRouter({ apiKey });
        aiModel = openrouter(modelConfig.modelId);
        break;

      default:
        return new NextResponse(
          JSON.stringify({ error: 'Unsupported model provider' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
    }

    const result = streamText({
      model: aiModel,
      messages: convertToModelMessages(messages as UIMessage[]),
      maxOutputTokens: modelConfig.maxOutputTokens,
      onError: (error) => {
        console.error('AI streaming error:', error);
      },
      system: `
      You are Chat0, an ai assistant that can answer questions and help with tasks.
      Be helpful and provide relevant information
      Be respectful and polite in all interactions.
      Be engaging and maintain a conversational tone.
      Always use LaTeX for mathematical expressions - 
      Inline math must be wrapped in single dollar signs: $content$
      Display math must be wrapped in double dollar signs: $$content$$
      Display math should be placed on its own line, with nothing else on that line.
      Do not nest math delimiters or mix styles.
      Examples:
      - Inline: The equation $E = mc^2$ shows mass-energy equivalence.
      - Display: 
      $$\\frac{d}{dx}\\sin(x) = \\cos(x)$$
      `,
      experimental_transform: [smoothStream({ chunking: 'word' })],
      abortSignal: req.signal,
    });

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      onError: (error) => {
        if (error == null) return 'unknown error';
        if (typeof error === 'string') return error;
        if (error instanceof Error) return error.message;
        return JSON.stringify(error);
      },
    });
  } catch (error) {
    console.error('API route error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal Server Error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
