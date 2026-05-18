import { Injectable } from '@nestjs/common';
import { Pinecone, Index } from '@pinecone-database/pinecone';

@Injectable()
export class PineconeProvider {
  private readonly client: Pinecone;
  private _index: Index | null = null;

  constructor() {
    const apiKey = process.env['PINECONE_API_KEY'];
    if (!apiKey) throw new Error('Missing PINECONE_API_KEY');
    this.client = new Pinecone({ apiKey });
  }

  getIndex(): Index {
    if (!this._index) {
      const indexName = process.env['PINECONE_INDEX_NAME'] ?? 'ai-biz-os-memories';
      this._index = this.client.index(indexName);
    }
    return this._index;
  }

  getClient(): Pinecone {
    return this.client;
  }
}
