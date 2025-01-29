import { log } from "./log"
import {
  addErrorUrl,
  addUrl,
  clearUserIndexing,
  isUserFullIndexed,
  isUserIndexing,
  markUserFullIndexed,
  markUserIndexing,
  urlExists,
} from "./redis"
import { isValidUrl } from "./util"
import {
  ingest_url,
  ingest_md,
  ingest_jsonl,
  ingest_text_content,
} from "./ingest"

import { getFileContent } from "./parser"
import { checkAuth, getToken } from "./auth"
import { DatabaseFactory } from "./db"
import { dbConfig } from "./config"
import { documentSchema } from "./schema"
import { processAllUserSearchMessages } from "./memfree_index"

const allowedOrigins = ["http://localhost:3000", "https://www.memfree.me"]

const db = DatabaseFactory.createDatabase( dbConfig, documentSchema )

async function handleRequest( req: Request ): Promise<Response> {
  const path = new URL( req.url ).pathname
  const { method } = req

  if ( method === "OPTIONS" ) {
    const origin = req.headers.get( "Origin" )
    if ( origin && allowedOrigins.includes( origin ) ) {
      return new Response( "OK", {
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type, Token",
        },
      } )
    } else {
      return new Response( "Forbidden", { status: 403 } )
    }
  }

  let authResponse = checkAuth( req, path )
  if ( authResponse ) {
    return authResponse
  }

  if ( path === "/api/vector/search" && method === "POST" ) {
    const { query, userId, selectFields, limit, url } = await req.json()
    try {
      const searchOptions = {
        ...( limit && { limit } ),
        ...( selectFields && { selectFields } ),
        ...( url && { predicate: `url == '${url}'` } ),
      }

      const result = await db.search( userId, query, searchOptions )
      return Response.json( result )
    } catch ( unknownError ) {
      let errorMessage: string | null = null

      if ( unknownError instanceof Error ) {
        errorMessage = unknownError.message
      } else if ( typeof unknownError === "string" ) {
        errorMessage = unknownError
      }

      if (
        errorMessage &&
        errorMessage.includes( "Table" ) &&
        errorMessage.includes( "was not found" )
      ) {
        return new Response( JSON.stringify( [] ), { status: 200 } )
      }

      log( {
        service: "vector-search",
        action: `error-search`,
        error: `${errorMessage}`,
        query: query,
        userId: userId,
      } )
      if ( errorMessage ) {
        return Response.json( "Failed to search", { status: 500 } )
      }
    }
  }

  if ( path === "/api/detail/search" && method === "POST" ) {
    const { userId, selectFields, limit, offset, url } = await req.json()
    try {
      const searchOptions = {
        ...( limit && { limit } ),
        ...( offset && { offset } ),
        ...( selectFields && { selectFields } ),
        ...( url && { predicate: `url == '${url}'` } ),
      }

      const result = await db.searchDetail( userId, searchOptions )
      return Response.json( result )
    } catch ( unknownError ) {
      let errorMessage: string | null = null

      if ( unknownError instanceof Error ) {
        errorMessage = unknownError.message
      } else if ( typeof unknownError === "string" ) {
        errorMessage = unknownError
      }

      if (
        errorMessage &&
        errorMessage.includes( "Table" ) &&
        errorMessage.includes( "was not found" )
      ) {
        return new Response( JSON.stringify( [] ), { status: 200 } )
      }

      log( {
        service: "detail-search",
        action: `error-search`,
        error: `${errorMessage}`,
        userId: userId,
      } )
      if ( errorMessage ) {
        return Response.json( "Failed to search", { status: 500 } )
      }
    }
  }

  if ( path === "/api/vector/delete" && method === "POST" ) {
    const { urls, userId } = await req.json()
    try {
      await db.deleteUrls( userId, urls )
      return Response.json( "Success" )
    } catch ( error ) {
      log( {
        service: "vector-index",
        action: "error-delete-urls",
        error: `${error}`,
        urls: urls,
        userId: userId,
      } )
      return Response.json( "Failed to delete urls", { status: 500 } )
    }
  }

  if ( path === "/api/vector/compact" && method === "POST" ) {
    const { userId } = await req.json()
    try {
      console.time( `compact-${userId}` )
      await db.compact( userId )
      console.timeEnd( `compact-${userId}` )
      return Response.json( "Success" )
    } catch ( error ) {
      log( {
        service: "vector-index",
        action: "error-compact",
        error: `${error}`,
        userId: userId,
      } )
      return Response.json( "Failed to compact", { status: 500 } )
    }
  }

  if ( path === "/api/index/url" && method === "POST" ) {
    const { url, userId } = await req.json()
    try {
      if ( !isValidUrl( url ) ) {
        return Response.json( "Invalid URL format", { status: 400 } )
      }
      await ingest_url( url, userId )
      return Response.json( "Success" )
    } catch ( error ) {
      log( {
        service: "vector-index",
        action: "error-index-url",
        error: `${error}`,
        url: url,
        userId: userId,
      } )
      await addErrorUrl( userId, url )
      return Response.json( `Failed to search ${error}`, { status: 500 } )
    }
  }

  if ( path === "/api/index/local-file" && method === "POST" ) {
    const startTime = new Date().getTime()
    const token = await getToken( req, server.development )
    if ( !token ) {
      return Response.json( "Unauthorized", { status: 401 } )
    }
    const formData = await req.formData()
    const file = formData.get( "file" ) as File
    const userId = token.sub
    let url = file.name
    try {
      const fileContent = await getFileContent( file )
      const { type, markdown } = fileContent
      url = fileContent.url
      const title = file.name

      if ( !userId || !markdown || !title ) {
        return Response.json( "Invalid parameters", { status: 400 } )
      }

      const existedUrl = await urlExists( userId, url )
      if ( existedUrl ) {
        await db.deleteUrls( userId, [url] )
        log( {
          service: "vector-index",
          action: "delete-local-file",
          userId: userId,
          url: url,
        } )
      }

      switch ( type ) {
        case "md":
          await ingest_md( url, userId, markdown, title )
          break
        case "pdf":
        case "docx":
        case "pptx":
          await ingest_text_content( url, userId, markdown, title )
          break
        default:
          return Response.json( "Invalid file type", { status: 400 } )
      }

      const indexCount = await addUrl( userId, url )
      if ( indexCount % 50 === 0 ) {
        await db.compact( userId )
        log( {
          service: "vector-index",
          action: "compact-local-file",
          userId: userId,
          url: url,
        } )
      }

      log( {
        service: "vector-index",
        action: "index-local-file",
        userId: userId,
        size: markdown.length,
        time: new Date().getTime() - startTime,
      } )

      const response = Response.json( [
        {
          url: url,
          name: file.name,
          type: file.type,
        },
      ] )
      response.headers.set( "Access-Control-Allow-Origin", "*" )
      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      )
      return response
    } catch ( error ) {
      log( {
        service: "vector-index",
        action: "error-index-file",
        error: `${error}`,
        url: url,
        userId: userId,
      } )
      return Response.json( "Failed to index markdown", { status: 500 } )
    }
  }

  if ( path === "/api/index/file" && method === "POST" ) {
    const { url, userId, markdown, title, type } = await req.json()
    try {
      if ( !userId || !markdown || !title ) {
        return Response.json( "Invalid parameters", { status: 400 } )
      }
      switch ( type ) {
        case "md":
          await ingest_md( url, userId, markdown, title )
          break
        case "pdf":
        case "docx":
        case "pptx":
          await ingest_text_content( url, userId, markdown, title )
          break
        default:
          return Response.json( "Invalid file type", { status: 400 } )
      }
      return Response.json( "Success" )
    } catch ( error ) {
      log( {
        service: "vector-index",
        action: "error-index-file",
        error: `${error}`,
        url: url,
        userId: userId,
      } )
      return Response.json( "Failed to index markdown", { status: 500 } )
    }
  }

  if ( path === "/api/index/md" && method === "POST" ) {
    const { url, userId, markdown, title } = await req.json()
    try {
      if ( !isValidUrl( url ) ) {
        return Response.json( "Invalid URL format", { status: 400 } )
      }
      if ( !userId || !markdown || !title ) {
        return Response.json( "Invalid parameters", { status: 400 } )
      }
      await ingest_md( url, userId, markdown, title )
      return Response.json( "Success" )
    } catch ( error ) {
      log( {
        service: "vector-index",
        action: "error-index-md",
        error: `${error}`,
        url: url,
        userId: userId,
      } )
      return Response.json( "Failed to index markdown", { status: 500 } )
    }
  }

  if ( path === "/api/index/jsonl" && method === "POST" ) {
    const { url, userId } = await req.json()
    try {
      if ( !isValidUrl( url ) ) {
        return Response.json( "Invalid URL format", { status: 400 } )
      }
      await ingest_jsonl( url, userId )
      return Response.json( "Success" )
    } catch ( error ) {
      log( {
        service: "vector-index",
        action: "error-index-jsonl",
        error: `${error}`,
        url: url,
        userId: userId,
      } )
      return Response.json( "Failed to index markdown", { status: 500 } )
    }
  }

  if ( path === "/api/history/full" && method === "POST" ) {
    const { userId } = await req.json()
    try {
      const indexed = await isUserFullIndexed( userId )
      if ( indexed ) {
        return Response.json( "Already indexed", { status: 200 } )
      }

      const indexing = await isUserIndexing( userId )
      if ( indexing ) {
        return Response.json( "Indexing in progress", { status: 409 } ) // 409 Conflict
      }

      await markUserIndexing( userId )

      Promise.resolve().then( async () => {
        try {
          const success = await processAllUserSearchMessages( userId )
          if ( success ) {
            await markUserFullIndexed( userId )
          }
        } catch ( error ) {
          console.error( "Background indexing error:", error )
        } finally {
          await clearUserIndexing( userId )
        }
      } )
      return Response.json( "Success" )
    } catch ( error ) {
      log( {
        service: "vector-index",
        action: "history-full-index",
        error: `${error}`,
        userId: userId,
      } )
      await clearUserIndexing( userId )
      return Response.json( `Failed to search ${error}`, { status: 500 } )
    }
  }

  if ( path === "/api/history/single" && method === "POST" ) {
    const { url, userId, text, title } = await req.json()
    try {
      if ( !userId || !text || !title ) {
        return Response.json( "Invalid parameters", { status: 400 } )
      }
      console.log( "Indexing single", url, userId, text.length, title )
      await ingest_text_content( url, userId, text, title )
      return Response.json( "Success" )
    } catch ( error ) {
      log( {
        service: "vector-index",
        action: "error-index-md",
        error: `${error}`,
        url: url,
        userId: userId,
      } )
      return Response.json( "Failed to index markdown", { status: 500 } )
    }
  }

  // if (path === "/api/vector/change-embedding" && method === "POST") {
  //   const { userId } = await req.json();
  //   try {
  //     await changeEmbedding(userId);
  //     return Response.json("Success");
  //   } catch (error) {
  //     logError(error as Error, "change-embedding");
  //     return Response.json("Failed to change embedding", { status: 500 });
  //   }
  // }

  if ( path === "/" ) return Response.json( "Welcome to memfree vector service!" )
  return Response.json( "Page not found", { status: 404 } )
}

export const server = Bun.serve( {
  port: process.env.PORT || 3001,
  fetch: handleRequest,
} )

console.log( `Listening on ${server.url}, is dev: ${server.development}` )
