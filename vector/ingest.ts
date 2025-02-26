import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

import { getMd, readFromJsonlFile } from "./util";
import { getEmbedding } from "./embedding/embedding";
import { processTweet } from "./tweet";
import { DatabaseFactory } from "./db";
import { dbConfig } from "./config";
import { documentSchema } from "./schema";

const mdSplitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
  chunkSize: 400,
  chunkOverlap: 40,
});

export const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 400,
  chunkOverlap: 40,
});

function extractImage(markdown: string) {
  const imageRegex = /!\[.*?\]\((.*?)\)/;
  const match = imageRegex.exec(markdown);
  return match ? match[1] : null;
}

const db = DatabaseFactory.createDatabase(dbConfig, documentSchema);

export async function ingest_jsonl(url: string, userId: string) {
  const data = await readFromJsonlFile(url);
  const table = await db.append(userId, data);
}

export async function ingest_text_content(
  url: string,
  userId: string,
  content: string,
  title: string
) {
  const documents = await textSplitter.createDocuments([content]);
  const data = await addVectors("", title, url, documents);
  const table = await db.append(userId, data);
}

export async function processIngestion(
  url: string,
  userId: string,
  markdown: string,
  title: string,
  image: string
) {
  const documents = await mdSplitter.createDocuments([markdown], [], {
    appendChunkOverlapHeader: false,
  });
  const data = await addVectors(image, title, url, documents);
  const table = await db.append(userId, data);
}

export async function appendData(
  userId: string,
  data: Array<Record<string, unknown>>
) {
  const table = await db.append(userId, data);
}

export async function compact(userId: string) {
  await db.compact(userId);
}

export async function ingest_md(
  url: string,
  userId: string,
  markdown: string,
  title: string
) {
  let image = extractImage(markdown) || (await processTweet(url)).image;
  console.log(
    "url",
    url,
    "userId",
    userId,
    "markdown",
    markdown.length,
    "title",
    title,
    "image",
    image
  );
  await processIngestion(url, userId, markdown, title, image ?? "");
}

export async function ingest_url(url: string, userId: string) {
  const markdown = await getMd(url, userId);
  const title = await extractTitle(markdown, url);
  let image = extractImage(markdown) || (await processTweet(url)).image;
  console.log(
    "url",
    url,
    "userId",
    userId,
    "markdown",
    markdown.length,
    "title",
    title,
    "image",
    image
  );
  await processIngestion(url, userId, markdown, title, image ?? "");
}

export async function addVectors(
  image: string,
  title: string,
  url: string,
  documents: Document[],
  timestamp?: number
): Promise<Array<Record<string, unknown>>> {
  const texts = documents.map(({ pageContent }) => pageContent);
  if (texts.length === 0) {
    return [];
  }

  const embeddings = await getEmbedding().embedDocuments(texts);
  const data: Array<Record<string, unknown>> = [];

  for (let i = 0; i < documents.length; i += 1) {
    if (documents[i].pageContent.length < 10) {
      continue;
    }

    const newImage = image ? extractImage(documents[i].pageContent) : null;

    const record = {
      create_time: timestamp || Date.now(),
      title: title,
      url: url,
      image: newImage || image,
      text: documents[i].pageContent,
      vector: embeddings[i] as number[],
    };
    data.push(record);
  }
  return data;
}

async function extractTitle(markdown: string, url: string): Promise<string> {
  const titlePattern = /^Title: (.+)$/m;
  const match = markdown.match(titlePattern);
  if (match && match[1]) {
    return match[1].trim();
  }

  return url;
}
