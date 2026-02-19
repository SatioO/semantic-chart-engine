import { ChatGroq } from '@langchain/groq';
import { HumanMessage } from '@langchain/core/messages';

export interface ILangChainService {
  chat(message: string): Promise<string>;
}

export class LangChainService implements ILangChainService {
  private model: ChatGroq;

  constructor() {
    this.model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      temperature: 0,
      model: 'llama3-8b-8192',
    });
  }

  async chat(message: string): Promise<string> {
    const response = await this.model.invoke([new HumanMessage(message)]);
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return response.content.toString();
  }
}
