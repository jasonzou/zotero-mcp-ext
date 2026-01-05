"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/modules/itemFormatter.ts
  function formatItemBrief(item) {
    return {
      key: item.key,
      title: item.getField("title") || "No Title",
      creators: item.getCreators().map((c) => `${c.firstName || ""} ${c.lastName || ""}`.trim()).join(", "),
      date: item.getField("date")?.match(/\d{4}/)?.[0] || ""
      // Extract year
    };
  }
  async function formatItem(item, fields) {
    let fieldsToExport;
    if (fields) {
      fieldsToExport = fields;
    } else {
      fieldsToExport = [
        "title",
        "creators",
        "date",
        "itemType",
        "publicationTitle",
        "volume",
        "issue",
        "pages",
        "DOI",
        "url",
        "abstractNote",
        "tags",
        "notes",
        "attachments"
      ];
    }
    const formattedItem = {
      key: item.key,
      itemType: item.itemType,
      zoteroUrl: `zotero://select/library/items/${item.key}`
    };
    function safeGetString(value) {
      if (value === null || value === void 0) return "";
      return String(value);
    }
    for (const field of fieldsToExport) {
      try {
        switch (field) {
          case "attachments":
            try {
              const attachmentIds = item.getAttachments(false);
              const attachments = Zotero.Items.get(attachmentIds);
              const processedAttachments = [];
              for (const attachment of attachments) {
                try {
                  if (!attachment || !attachment.isAttachment()) {
                    continue;
                  }
                  const attachmentData = {
                    key: attachment.key || "",
                    linkMode: attachment.attachmentLinkMode || 0,
                    hasFulltext: false,
                    size: 0
                  };
                  try {
                    attachmentData.title = safeGetString(attachment.getField("title"));
                  } catch (e) {
                    attachmentData.title = "";
                    ztoolkit.log(`[ItemFormatter] Error getting attachment title: ${e}`, "error");
                  }
                  try {
                    attachmentData.path = safeGetString(attachment.getFilePath());
                  } catch (e) {
                    attachmentData.path = "";
                    ztoolkit.log(`[ItemFormatter] Error getting attachment path: ${e}`, "error");
                  }
                  try {
                    attachmentData.contentType = safeGetString(attachment.attachmentContentType);
                  } catch (e) {
                    attachmentData.contentType = "";
                    ztoolkit.log(`[ItemFormatter] Error getting attachment contentType: ${e}`, "error");
                  }
                  try {
                    attachmentData.filename = safeGetString(attachment.attachmentFilename);
                  } catch (e) {
                    attachmentData.filename = "";
                    ztoolkit.log(`[ItemFormatter] Error getting attachment filename: ${e}`, "error");
                  }
                  try {
                    attachmentData.url = safeGetString(attachment.getField("url"));
                  } catch (e) {
                    attachmentData.url = "";
                    ztoolkit.log(`[ItemFormatter] Error getting attachment url: ${e}`, "error");
                  }
                  try {
                    attachmentData.hasFulltext = hasExtractableText(attachment);
                  } catch (e) {
                    ztoolkit.log(`[ItemFormatter] Error checking extractable text: ${e}`, "error");
                  }
                  try {
                    attachmentData.size = await getAttachmentSize(attachment);
                  } catch (e) {
                    ztoolkit.log(`[ItemFormatter] Error getting attachment size: ${e}`, "error");
                  }
                  if (attachmentData.key) {
                    processedAttachments.push(attachmentData);
                  }
                } catch (e) {
                  ztoolkit.log(
                    `[ItemFormatter] Error processing attachment: ${e}`,
                    "error"
                  );
                  continue;
                }
              }
              formattedItem[field] = processedAttachments;
            } catch (e) {
              ztoolkit.log(
                `[ItemFormatter] Error getting attachments: ${e}`,
                "error"
              );
              formattedItem[field] = [];
            }
            break;
          case "creators":
            try {
              formattedItem[field] = item.getCreators().map((creator) => ({
                firstName: safeGetString(creator.firstName),
                lastName: safeGetString(creator.lastName),
                creatorType: safeGetString(
                  Zotero.CreatorTypes.getName(creator.creatorTypeID)
                ) || "unknown"
              }));
            } catch (e) {
              ztoolkit.log(
                `[ItemFormatter] Error getting creators: ${e}`,
                "error"
              );
              formattedItem[field] = [];
            }
            break;
          case "tags":
            try {
              formattedItem[field] = item.getTags().map((tag) => safeGetString(tag.tag));
            } catch (e) {
              ztoolkit.log(`[ItemFormatter] Error getting tags: ${e}`, "error");
              formattedItem[field] = [];
            }
            break;
          case "notes":
            try {
              formattedItem[field] = item.getNotes(false).map((noteId) => {
                try {
                  const note = Zotero.Items.get(noteId);
                  return note ? safeGetString(note.getNote()) : "";
                } catch (e) {
                  ztoolkit.log(
                    `[ItemFormatter] Error getting note ${noteId}: ${e}`,
                    "error"
                  );
                  return "";
                }
              }).filter((note) => note);
            } catch (e) {
              ztoolkit.log(`[ItemFormatter] Error getting notes: ${e}`, "error");
              formattedItem[field] = [];
            }
            break;
          case "date":
            try {
              formattedItem[field] = safeGetString(item.getField("date"));
            } catch (e) {
              ztoolkit.log(`[ItemFormatter] Error getting date: ${e}`, "error");
              formattedItem[field] = "";
            }
            break;
          default:
            try {
              const value = item.getField(field);
              formattedItem[field] = safeGetString(value);
            } catch (e) {
              formattedItem[field] = "";
            }
            break;
        }
      } catch (e) {
        ztoolkit.log(
          `[ItemFormatter] Error processing field ${field}: ${e}`,
          "error"
        );
        formattedItem[field] = null;
      }
    }
    return formattedItem;
  }
  function hasExtractableText(attachment) {
    try {
      if (!attachment.isAttachment()) return false;
      const contentType = attachment.attachmentContentType || "";
      const path = attachment.getFilePath() || "";
      if (contentType.includes("pdf") || path.toLowerCase().endsWith(".pdf")) {
        return true;
      }
      if (contentType.includes("text") || [".txt", ".md", ".html", ".htm", ".xml"].some((ext) => path.toLowerCase().endsWith(ext))) {
        return true;
      }
      return false;
    } catch (error) {
      ztoolkit.log(`[ItemFormatter] Error checking extractable text: ${error}`, "error");
      return false;
    }
  }
  async function getAttachmentSize(attachment) {
    try {
      if (!attachment.isAttachment()) return 0;
      const path = attachment.getFilePath();
      if (!path) return 0;
      if (typeof OS !== "undefined" && OS.File && OS.File.stat) {
        try {
          const stat = await OS.File.stat(path);
          return stat.size || 0;
        } catch (e) {
          ztoolkit.log(`[ItemFormatter] OS.File.stat failed: ${e}`, "error");
        }
      }
      try {
        const file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        file.initWithPath(path);
        if (file.exists()) {
          return file.fileSize || 0;
        }
      } catch (e) {
        ztoolkit.log(`[ItemFormatter] nsIFile method failed: ${e}`, "error");
      }
      return 0;
    } catch (error) {
      ztoolkit.log(`[ItemFormatter] Error getting attachment size: ${error}`, "error");
      return 0;
    }
  }
  async function formatItems(items, fields) {
    ztoolkit.log(`[ItemFormatter] formatItems called with ${items.length} items, fields: ${fields?.join(", ") || "default"}`);
    try {
      const results = await Promise.all(items.map(async (item, index) => {
        try {
          ztoolkit.log(`[ItemFormatter] Processing item ${index + 1}/${items.length}: ${item.key} (${item.getField("title") || "No title"})`);
          const formatted = await formatItem(item, fields);
          ztoolkit.log(`[ItemFormatter] Successfully formatted item ${item.key}`);
          return formatted;
        } catch (error) {
          ztoolkit.log(`[ItemFormatter] Error formatting item ${item.key}: ${error}`, "error");
          return {
            key: item.key || "",
            title: "Error formatting item",
            error: true,
            errorMessage: error instanceof Error ? error.message : String(error)
          };
        }
      }));
      ztoolkit.log(`[ItemFormatter] formatItems completed: ${results.length} items formatted`);
      return results;
    } catch (error) {
      ztoolkit.log(`[ItemFormatter] Fatal error in formatItems: ${error}`, "error");
      throw error;
    }
  }
  var init_itemFormatter = __esm({
    "src/modules/itemFormatter.ts"() {
      "use strict";
    }
  });

  // src/modules/collectionFormatter.ts
  function formatCollection(collection) {
    if (!collection) {
      return null;
    }
    return {
      key: collection.key,
      version: collection.version,
      libraryID: collection.libraryID,
      name: collection.name,
      parentCollection: collection.parentKey,
      relations: collection.getRelations()
    };
  }
  function formatCollectionBrief(collection) {
    if (!collection) {
      return null;
    }
    return {
      key: collection.key,
      name: collection.name,
      parentCollection: collection.parentKey
    };
  }
  function formatCollectionList(collections) {
    return collections.map(formatCollectionBrief);
  }
  function formatCollectionDetails(collection, options = {}) {
    const details = formatCollection(collection);
    if (!details) {
      return null;
    }
    const childItemIDs = collection.getChildItems(true);
    const childCollectionIDs = collection.getChildCollections(true);
    const response = {
      ...details,
      meta: {
        numItems: childItemIDs.length,
        numCollections: childCollectionIDs.length
      }
    };
    if (options.includeItems) {
      const limit = options.itemsLimit || childItemIDs.length;
      const items = Zotero.Items.get(childItemIDs.slice(0, limit));
      response.items = formatItems(items);
    }
    if (options.includeSubcollections) {
      const collections = Zotero.Collections.get(childCollectionIDs);
      response.subcollections = formatCollectionList(collections);
    }
    return response;
  }
  var init_collectionFormatter = __esm({
    "src/modules/collectionFormatter.ts"() {
      "use strict";
      init_itemFormatter();
    }
  });

  // src/modules/searchEngine.ts
  function parseDateRange(rangeStr) {
    if (!rangeStr) return { start: null, end: null };
    if (rangeStr.includes(",")) {
      const [startStr, endStr] = rangeStr.split(",").map((s) => s.trim());
      return {
        start: startStr ? new Date(startStr) : null,
        end: endStr ? new Date(endStr) : null
      };
    }
    if (rangeStr.includes("-")) {
      const parts = rangeStr.split("-");
      if (parts.length === 2) {
        const [startYear, endYear] = parts;
        return {
          start: startYear ? /* @__PURE__ */ new Date(`${startYear}-01-01`) : null,
          end: endYear ? /* @__PURE__ */ new Date(`${endYear}-12-31`) : null
        };
      }
    }
    return { start: null, end: null };
  }
  function parseNumberRange(rangeStr) {
    if (!rangeStr) return { min: null, max: null };
    if (rangeStr.includes("-")) {
      const parts = rangeStr.split("-");
      if (parts.length === 2) {
        const [minStr, maxStr] = parts;
        return {
          min: minStr ? parseInt(minStr, 10) : null,
          max: maxStr ? parseInt(maxStr, 10) : null
        };
      }
    }
    return { min: null, max: null };
  }
  function matchesFieldQuery(fieldValue, operator, queryValue) {
    if (!fieldValue && !queryValue) return true;
    if (!fieldValue || !queryValue) return false;
    const fieldStr = String(fieldValue).toLowerCase();
    const queryStr = queryValue.toLowerCase();
    switch (operator) {
      case "exact":
        return fieldStr === queryStr;
      case "contains":
        return fieldStr.includes(queryStr);
      case "startsWith":
        return fieldStr.startsWith(queryStr);
      case "endsWith":
        return fieldStr.endsWith(queryStr);
      case "regex":
        try {
          const regex = new RegExp(queryValue, "i");
          return regex.test(fieldStr);
        } catch {
          return false;
        }
      default:
        return fieldStr.includes(queryStr);
    }
  }
  function calculateRelevanceScore(item, params) {
    let score = 0;
    const matchedFields = [];
    const boostFields = params.boostFields?.split(",").map((f) => f.trim()) || [];
    const fieldWeights = {
      title: 3,
      creator: 2,
      abstractNote: 1.5,
      publicationTitle: 1.2,
      tags: 1,
      extra: 0.5
    };
    boostFields.forEach((field) => {
      if (fieldWeights[field]) {
        fieldWeights[field] *= 2;
      }
    });
    if (params.q) {
      const query = params.q.toLowerCase();
      Object.entries(fieldWeights).forEach(([field, weight]) => {
        let fieldValue = "";
        if (field === "creator") {
          fieldValue = item.getCreators().map((c) => `${c.firstName} ${c.lastName}`).join(" ");
        } else if (field === "tags") {
          fieldValue = item.getTags().map((t) => t.tag).join(" ");
        } else {
          try {
            fieldValue = item.getField(field) || "";
          } catch {
            fieldValue = "";
          }
        }
        if (fieldValue.toLowerCase().includes(query)) {
          score += weight;
          matchedFields.push(field);
        }
      });
    }
    if (params.title && item.getField("title")?.toLowerCase().includes(params.title.toLowerCase())) {
      score += fieldWeights.title || 3;
      if (!matchedFields.includes("title")) matchedFields.push("title");
    }
    if (params.creator) {
      const creators = item.getCreators().map((c) => `${c.firstName} ${c.lastName}`.toLowerCase());
      if (creators.some((c) => c.includes(params.creator.toLowerCase()))) {
        score += fieldWeights.creator || 2;
        if (!matchedFields.includes("creator")) matchedFields.push("creator");
      }
    }
    return { score, matchedFields };
  }
  async function performFulltextSearch(query, libraryID, mode = "both", operator = "contains") {
    const matchDetails = /* @__PURE__ */ new Map();
    let itemIDs = [];
    try {
      if (mode === "attachment" || mode === "both") {
        const attachmentSearch = new Zotero.Search();
        attachmentSearch.libraryID = libraryID;
        const searchOperator = operator === "exact" ? "is" : "contains";
        attachmentSearch.addCondition("fulltextContent", searchOperator, query);
        attachmentSearch.addCondition("itemType", "is", "attachment");
        const attachmentIDs = await attachmentSearch.search();
        for (const attachmentID of attachmentIDs) {
          const attachment = Zotero.Items.get(attachmentID);
          if (attachment && attachment.isAttachment()) {
            const parentItem = attachment.parentItem;
            const targetID = parentItem ? parentItem.id : attachment.id;
            if (parentItem && !itemIDs.includes(parentItem.id)) {
              itemIDs.push(parentItem.id);
            } else if (!parentItem && !itemIDs.includes(attachment.id)) {
              itemIDs.push(attachment.id);
            }
            if (!matchDetails.has(targetID)) {
              matchDetails.set(targetID, {
                attachments: [],
                notes: [],
                score: 0
              });
            }
            const details = matchDetails.get(targetID);
            let snippet = "";
            try {
              const content = await attachment.attachmentText || "";
              if (content) {
                const queryPos = content.toLowerCase().indexOf(query.toLowerCase());
                if (queryPos >= 0) {
                  const start = Math.max(0, queryPos - 50);
                  const end = Math.min(content.length, queryPos + query.length + 50);
                  snippet = "..." + content.substring(start, end) + "...";
                }
              }
            } catch (e) {
              snippet = "";
            }
            details.attachments.push({
              attachmentID: attachment.id,
              filename: attachment.attachmentFilename || "",
              snippet,
              score: 1
            });
            details.score += 1;
          }
        }
      }
      if (mode === "note" || mode === "both") {
        const s = new Zotero.Search();
        s.libraryID = libraryID;
        s.addCondition("itemType", "is", "note");
        const searchOperator = operator === "exact" ? "is" : "contains";
        s.addCondition("note", searchOperator, query);
        const noteIDs = await s.search();
        for (const noteID of noteIDs) {
          const note = Zotero.Items.get(noteID);
          if (note && note.isNote()) {
            const parentItem = note.parentItem;
            if (parentItem && !itemIDs.includes(parentItem.id)) {
              itemIDs.push(parentItem.id);
            }
            const targetID = parentItem ? parentItem.id : note.id;
            if (!matchDetails.has(targetID)) {
              matchDetails.set(targetID, {
                attachments: [],
                notes: [],
                score: 0
              });
            }
            const details = matchDetails.get(targetID);
            const noteContent = note.getNote();
            let snippet = "";
            if (noteContent) {
              const cleanContent = noteContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
              const queryPos = cleanContent.toLowerCase().indexOf(query.toLowerCase());
              if (queryPos >= 0) {
                const start = Math.max(0, queryPos - 50);
                const end = Math.min(cleanContent.length, queryPos + query.length + 50);
                snippet = "..." + cleanContent.substring(start, end) + "...";
              }
            }
            details.notes.push({
              noteID: note.id,
              snippet,
              score: 1
            });
            details.score += 1;
          }
        }
      }
      return { itemIDs: [...new Set(itemIDs)], matchDetails };
    } catch (error) {
      ztoolkit.log(`[SearchEngine] Fulltext search error: ${error}`, "error");
      return { itemIDs: [], matchDetails };
    }
  }
  function applyAdvancedFilters(items, params) {
    return items.filter((item) => {
      if (params.yearRange) {
        const { start, end } = parseDateRange(params.yearRange);
        if (start || end) {
          const itemDate = item.getField("date");
          if (itemDate) {
            const year = parseInt(itemDate.toString().substring(0, 4), 10);
            if (start && year < start.getFullYear()) return false;
            if (end && year > end.getFullYear()) return false;
          }
        }
      }
      if (params.dateAddedRange) {
        const { start, end } = parseDateRange(params.dateAddedRange);
        if (start || end) {
          const dateAdded = new Date(item.dateAdded);
          if (start && dateAdded < start) return false;
          if (end && dateAdded > end) return false;
        }
      }
      if (params.dateModifiedRange) {
        const { start, end } = parseDateRange(params.dateModifiedRange);
        if (start || end) {
          const dateModified = new Date(item.dateModified);
          if (start && dateModified < start) return false;
          if (end && dateModified > end) return false;
        }
      }
      if (params.numPagesRange) {
        const { min, max } = parseNumberRange(params.numPagesRange);
        if (min || max) {
          const numPages = parseInt(item.getField("numPages") || "0", 10);
          if (min && numPages < min) return false;
          if (max && numPages > max) return false;
        }
      }
      if (params.titleOperator && params.title) {
        const title = item.getField("title") || "";
        if (!matchesFieldQuery(title, params.titleOperator, params.title)) {
          return false;
        }
      }
      if (params.creatorOperator && params.creator) {
        const creators = item.getCreators().map((c) => `${c.firstName} ${c.lastName}`).join(" ");
        if (!matchesFieldQuery(creators, params.creatorOperator, params.creator)) {
          return false;
        }
      }
      if (params.abstractOperator && params.abstractText) {
        const abstract = item.getField("abstractNote") || "";
        if (!matchesFieldQuery(
          abstract,
          params.abstractOperator,
          params.abstractText
        )) {
          return false;
        }
      }
      if (params.publicationTitleOperator && params.publicationTitle) {
        const pubTitle = item.getField("publicationTitle") || "";
        if (!matchesFieldQuery(
          pubTitle,
          params.publicationTitleOperator,
          params.publicationTitle
        )) {
          return false;
        }
      }
      const exactMatchFields = ["language", "rights", "url", "extra"];
      for (const field of exactMatchFields) {
        const paramValue = params[field];
        if (paramValue && typeof paramValue === "string") {
          const fieldValue = item.getField(field) || "";
          if (!fieldValue.toLowerCase().includes(paramValue.toLowerCase())) {
            return false;
          }
        }
      }
      return true;
    });
  }
  async function handleSearchRequest(params) {
    Zotero.debug(
      `[MCP Search] Received search params: ${JSON.stringify(params)}`
    );
    const startTime = Date.now();
    const libraryID = params.libraryID ? parseInt(params.libraryID, 10) : Zotero.Libraries.userLibraryID;
    const limit = Math.min(parseInt(params.limit || "100", 10), 500);
    const offset = parseInt(params.offset || "0", 10);
    const sort = params.sort || "dateAdded";
    const direction = params.direction || "desc";
    if (!SUPPORTED_SORT_FIELDS.includes(sort)) {
      throw new MCPError(
        400,
        `Unsupported sort field: ${sort}. Supported fields are: ${SUPPORTED_SORT_FIELDS.join(", ")}`
      );
    }
    if (!["asc", "desc"].includes(direction.toLowerCase())) {
      throw new MCPError(
        400,
        `Unsupported sort direction: ${direction}. Use 'asc' or 'desc'.`
      );
    }
    if (params.key) {
      const item = await Zotero.Items.getByLibraryAndKeyAsync(
        libraryID,
        params.key
      );
      return {
        query: params,
        pagination: { limit: 1, offset: 0, total: item ? 1 : 0, hasMore: false },
        searchTime: `${Date.now() - startTime}ms`,
        results: item ? [await formatItem(item)] : []
      };
    }
    let fulltextItemIDs = [];
    let fulltextMatchDetails = /* @__PURE__ */ new Map();
    if (params.fulltext) {
      const mode = params.fulltextMode || "both";
      const operator = params.fulltextOperator || "contains";
      const fulltextResult = await performFulltextSearch(params.fulltext, libraryID, mode, operator);
      fulltextItemIDs = fulltextResult.itemIDs;
      fulltextMatchDetails = fulltextResult.matchDetails;
      if (fulltextItemIDs.length === 0) {
        return {
          query: params,
          pagination: { limit, offset, total: 0, hasMore: false },
          searchTime: `${Date.now() - startTime}ms`,
          results: [],
          searchFeatures: ["fulltext"]
        };
      }
    }
    const s = new Zotero.Search();
    s.libraryID = libraryID;
    if (params.q) {
      s.addCondition("quicksearch-everything", "contains", params.q);
    }
    const fieldMappings = {
      title: "title",
      creator: "creator",
      year: "date",
      itemType: "itemType",
      doi: "DOI",
      isbn: "ISBN"
    };
    if (params.tag && !params.tags) {
      fieldMappings.tag = "tag";
    }
    for (const [paramKey, conditionKey] of Object.entries(fieldMappings)) {
      const value = params[paramKey];
      if (value) {
        const operator = ["year", "itemType"].includes(paramKey) ? "is" : "contains";
        s.addCondition(conditionKey, operator, value);
      }
    }
    if (params.collection) {
      const collection = await Zotero.Collections.getByLibraryAndKeyAsync(
        libraryID,
        params.collection
      );
      if (collection) {
        s.addCondition("collection", "is", collection.id);
      } else {
        return {
          // 无效 collection，返回空结果
          query: params,
          pagination: { limit, offset, total: 0, hasMore: false },
          searchTime: `${Date.now() - startTime}ms`,
          results: []
        };
      }
    }
    if (params.hasAttachment)
      s.addCondition("attachment", "is", params.hasAttachment);
    if (params.hasNote) s.addCondition("note", "is", params.hasNote);
    if (params.includeAttachments !== "true")
      s.addCondition("itemType", "isNot", "attachment");
    if (params.includeNotes !== "true")
      s.addCondition("itemType", "isNot", "note");
    let initialItemIDs;
    if (params.fulltext && fulltextItemIDs.length > 0) {
      initialItemIDs = fulltextItemIDs;
    } else {
      initialItemIDs = await s.search();
    }
    if (initialItemIDs.length === 0) {
      return {
        query: params,
        pagination: { limit, offset, total: 0, hasMore: false },
        searchTime: `${Date.now() - startTime}ms`,
        results: []
      };
    }
    let items = await Zotero.Items.getAsync(initialItemIDs);
    const queryTags = Array.isArray(params.tags) ? params.tags : params.tags ? [params.tags] : [];
    const matchedTagsStats = {};
    if (queryTags.length > 0) {
      const tagMatch = params.tagMatch || "exact";
      const tagMode = params.tagMode || "any";
      const filteredItems = [];
      items.forEach((item) => {
        const itemTags = item.getTags().map((t) => t.tag);
        const matchedTags = [];
        for (const queryTag of queryTags) {
          const isMatch = itemTags.some((itemTag) => {
            switch (tagMatch) {
              case "contains":
                return itemTag.toLowerCase().includes(queryTag.toLowerCase());
              case "startsWith":
                return itemTag.toLowerCase().startsWith(queryTag.toLowerCase());
              case "exact":
              default:
                return itemTag.toLowerCase() === queryTag.toLowerCase();
            }
          });
          if (isMatch) {
            matchedTags.push(queryTag);
          }
        }
        const uniqueMatched = [...new Set(matchedTags)];
        let shouldInclude = false;
        switch (tagMode) {
          case "all":
            shouldInclude = uniqueMatched.length === queryTags.length;
            break;
          case "none":
            shouldInclude = uniqueMatched.length === 0;
            break;
          case "any":
          default:
            shouldInclude = uniqueMatched.length > 0;
            break;
        }
        if (shouldInclude) {
          item.matchedTags = uniqueMatched;
          filteredItems.push(item);
          uniqueMatched.forEach((tag) => {
            matchedTagsStats[tag] = (matchedTagsStats[tag] || 0) + 1;
          });
        }
      });
      items = filteredItems;
    }
    if (Object.keys(params).some(
      (key) => [
        "yearRange",
        "dateAddedRange",
        "dateModifiedRange",
        "numPagesRange",
        "titleOperator",
        "creatorOperator",
        "abstractOperator",
        "publicationTitleOperator",
        "language",
        "rights",
        "url",
        "extra"
      ].includes(key)
    )) {
      items = applyAdvancedFilters(items, params);
    }
    const useRelevanceScoring = params.relevanceScoring === "true" || sort === "relevance";
    let scoredItems = [];
    if (useRelevanceScoring) {
      scoredItems = items.map((item) => {
        const { score, matchedFields } = calculateRelevanceScore(item, params);
        return {
          item,
          relevanceScore: score,
          matchedFields
        };
      });
      if (sort === "relevance") {
        scoredItems.sort((a, b) => {
          const scoreA = a.relevanceScore;
          const scoreB = b.relevanceScore;
          return direction === "asc" ? scoreA - scoreB : scoreB - scoreA;
        });
        items = scoredItems.map((si) => si.item);
      } else {
        items.sort((a, b) => {
          let valA, valB;
          if (sort === "creator") {
            valA = a.getCreators().map((c) => c.lastName).join(", ");
            valB = b.getCreators().map((c) => c.lastName).join(", ");
          } else {
            valA = a.getField(sort) || "";
            valB = b.getField(sort) || "";
          }
          if (typeof valA === "string") valA = valA.toLowerCase();
          if (typeof valB === "string") valB = valB.toLowerCase();
          if (valA < valB) return direction === "asc" ? -1 : 1;
          if (valA > valB) return direction === "asc" ? 1 : -1;
          return 0;
        });
      }
    } else {
      items.sort((a, b) => {
        let valA, valB;
        if (sort === "creator") {
          valA = a.getCreators().map((c) => c.lastName).join(", ");
          valB = b.getCreators().map((c) => c.lastName).join(", ");
        } else {
          valA = a.getField(sort) || "";
          valB = b.getField(sort) || "";
        }
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    const total = items.length;
    const paginatedItems = items.slice(offset, offset + limit);
    const results = paginatedItems.map((item) => {
      const formatted = formatItemBrief(item);
      try {
        const attachmentIDs = item.getAttachments();
        if (attachmentIDs && attachmentIDs.length > 0) {
          formatted.attachments = attachmentIDs.map((id) => {
            const attachment = Zotero.Items.get(id);
            if (attachment && attachment.isAttachment()) {
              return {
                key: attachment.key,
                filename: attachment.attachmentFilename || "",
                filePath: attachment.getFilePath() || "",
                contentType: attachment.attachmentContentType || "",
                linkMode: attachment.attachmentLinkMode
              };
            }
            return null;
          }).filter((att) => att !== null);
        } else {
          formatted.attachments = [];
        }
      } catch (error) {
        ztoolkit.log(`[SearchEngine] Error getting attachments for item ${item.key}: ${error}`, "warn");
        formatted.attachments = [];
      }
      if (item.matchedTags) {
        formatted.matchedTags = item.matchedTags;
      }
      if (useRelevanceScoring) {
        const scoredItem = scoredItems.find((si) => si.item.id === item.id);
        if (scoredItem) {
          formatted.relevanceScore = scoredItem.relevanceScore;
          formatted.matchedFields = scoredItem.matchedFields;
        }
      }
      if (params.fulltext && fulltextMatchDetails.has(item.id)) {
        const matchDetails = fulltextMatchDetails.get(item.id);
        formatted.fulltextMatch = {
          query: params.fulltext,
          mode: params.fulltextMode || "both",
          attachments: matchDetails.attachments || [],
          notes: matchDetails.notes || [],
          totalScore: matchDetails.score || 0
        };
      }
      return formatted;
    });
    const response = {
      query: params,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total
      },
      searchTime: `${Date.now() - startTime}ms`,
      results
    };
    if (Object.keys(matchedTagsStats).length > 0) {
      response.matchedTags = matchedTagsStats;
    }
    if (useRelevanceScoring) {
      response.relevanceStats = {
        averageScore: scoredItems.length > 0 ? scoredItems.reduce((sum, item) => sum + item.relevanceScore, 0) / scoredItems.length : 0,
        maxScore: scoredItems.length > 0 ? Math.max(...scoredItems.map((item) => item.relevanceScore)) : 0,
        minScore: scoredItems.length > 0 ? Math.min(...scoredItems.map((item) => item.relevanceScore)) : 0
      };
    }
    const searchFeatures = [];
    if (params.q) searchFeatures.push("fulltext");
    if (queryTags.length > 0) searchFeatures.push("tags");
    if (params.yearRange) searchFeatures.push("dateRange");
    if (params.titleOperator || params.creatorOperator || params.abstractOperator) {
      searchFeatures.push("advancedOperators");
    }
    if (useRelevanceScoring) searchFeatures.push("relevanceScoring");
    response.searchFeatures = searchFeatures;
    response.version = "2.0";
    return response;
  }
  var MCPError, SUPPORTED_SORT_FIELDS;
  var init_searchEngine = __esm({
    "src/modules/searchEngine.ts"() {
      "use strict";
      init_itemFormatter();
      MCPError = class extends Error {
        status;
        constructor(status, message) {
          super(message);
          this.status = status;
          this.name = "MCPError";
        }
      };
      SUPPORTED_SORT_FIELDS = [
        "date",
        "title",
        "creator",
        "dateAdded",
        "dateModified",
        "relevance"
      ];
    }
  });

  // src/modules/pdfProcessor.ts
  var pdfProcessor_exports = {};
  __export(pdfProcessor_exports, {
    PDFProcessor: () => PDFProcessor
  });
  var PDFProcessor;
  var init_pdfProcessor = __esm({
    "src/modules/pdfProcessor.ts"() {
      "use strict";
      PDFProcessor = class {
        constructor(ztoolkit2) {
          this.ztoolkit = ztoolkit2;
          this.Zotero = ztoolkit2.getGlobal("Zotero");
          this.ztoolkit.log("[PDFProcessor] \u521D\u59CB\u5316");
        }
        Zotero;
        _worker = null;
        _lastPromiseID = 0;
        _waitingPromises = {};
        _init() {
          if (this._worker) return;
          this._worker = new Worker(
            "chrome://zotero/content/xpcom/pdfWorker/worker.js"
          );
          this._worker.addEventListener("message", (event) => {
            void (async () => {
              const message = event.data;
              if (message.responseID) {
                const { resolve, reject } = this._waitingPromises[message.responseID];
                delete this._waitingPromises[message.responseID];
                if (message.data) {
                  const textContent = typeof message.data === "string" ? message.data : message.data.text;
                  if (textContent !== void 0) {
                    resolve({ text: textContent });
                  } else {
                    reject(new Error("PDF text extraction returned invalid format"));
                  }
                } else {
                  reject(
                    new Error(JSON.stringify(message.error || "Unknown worker error"))
                  );
                }
                return;
              }
              if (message.id) {
                let respData = null;
                try {
                  if (message.action === "FetchBuiltInCMap") {
                    const response = await this.Zotero.HTTP.request(
                      "GET",
                      "resource://zotero/reader/pdf/web/cmaps/" + message.data + ".bcmap",
                      { responseType: "arraybuffer" }
                    );
                    respData = {
                      compressionType: 1,
                      cMapData: new Uint8Array(response.response)
                    };
                  } else if (message.action === "FetchStandardFontData") {
                    const response = await this.Zotero.HTTP.request(
                      "GET",
                      "resource://zotero/reader/pdf/web/standard_fonts/" + message.data,
                      { responseType: "arraybuffer" }
                    );
                    respData = new Uint8Array(response.response);
                  }
                } catch (e) {
                  this.ztoolkit.log("Failed to fetch font data:", e, "error");
                }
                this._worker.postMessage({ responseID: message.id, data: respData });
              }
            })();
          });
          this._worker.addEventListener("error", (error) => {
            this.ztoolkit.log("[PDFProcessor] Worker\u9519\u8BEF:", error, "error");
          });
        }
        async _query(action, data, transfer) {
          this._init();
          return new Promise((resolve, reject) => {
            this._lastPromiseID++;
            this._waitingPromises[this._lastPromiseID] = { resolve, reject };
            if (transfer) {
              this._worker.postMessage(
                { id: this._lastPromiseID, action, data },
                transfer
              );
            } else {
              this._worker.postMessage({ id: this._lastPromiseID, action, data });
            }
          });
        }
        /**
         * 提取PDF文本内容
         * @param path PDF文件路径
         * @returns Promise<string> 提取的文本内容
         */
        async extractText(path) {
          try {
            this.ztoolkit.log("[PDFProcessor] \u5F00\u59CB\u63D0\u53D6\u6587\u672C:", { path });
            const fileData = await IOUtils.read(path);
            if (!fileData) {
              throw new Error("\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25 (IOUtils.read returned falsy)");
            }
            this.ztoolkit.log(
              `[PDFProcessor] \u6587\u4EF6\u8BFB\u53D6\u6210\u529F: ${fileData.byteLength} bytes`
            );
            const response = await this._query(
              "getFulltext",
              {
                buf: fileData.buffer,
                // The original code used .buffer
                maxPages: null,
                password: void 0
              },
              [fileData.buffer]
            );
            if (!response?.text) {
              throw new Error("PDF text extraction returned empty result");
            }
            return response.text;
          } catch (error) {
            this.ztoolkit.log("[PDFProcessor] PDF\u6587\u672C\u63D0\u53D6\u5931\u8D25:", error, "error");
            throw error;
          }
        }
        /**
         * 提取PDF元数据
         * @param path PDF文件路径
         * @returns Promise<PDFMetadata> 提取的元数据
         */
        async extractMetadata(path) {
          try {
            this.ztoolkit.log("[PDFProcessor] \u5F00\u59CB\u63D0\u53D6PDF\u5143\u6570\u636E:", { path });
            const fileData = await IOUtils.read(path);
            if (!fileData) {
              throw new Error("\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25 (IOUtils.read returned falsy)");
            }
            const response = await this._query(
              "getMetadata",
              {
                buf: fileData.buffer,
                password: void 0
              },
              [fileData.buffer]
            );
            const info = response?.info || {};
            const metadata = {
              title: info.Title || void 0,
              author: info.Author || void 0,
              subject: info.Subject || void 0,
              keywords: info.Keywords ? info.Keywords.split(/[,;]\s*/).filter((k) => k.trim().length > 0) : void 0,
              creator: info.Creator || void 0,
              producer: info.Producer || void 0,
              creationDate: info.CreationDate || void 0,
              modificationDate: info.ModDate || void 0,
              pageCount: response?.numPages || void 0
            };
            this.ztoolkit.log("[PDFProcessor] PDF\u5143\u6570\u636E\u63D0\u53D6\u6210\u529F:", metadata);
            return metadata;
          } catch (error) {
            this.ztoolkit.log("[PDFProcessor] PDF\u5143\u6570\u636E\u63D0\u53D6\u5931\u8D25:", error, "error");
            return {};
          }
        }
        terminate() {
          if (this._worker) {
            this._worker.terminate();
            this._worker = null;
          }
        }
      };
    }
  });

  // src/modules/textFormatter.ts
  var textFormatter_exports = {};
  __export(textFormatter_exports, {
    TextFormatter: () => TextFormatter
  });
  var TextFormatter;
  var init_textFormatter = __esm({
    "src/modules/textFormatter.ts"() {
      "use strict";
      TextFormatter = class {
        static DEFAULT_OPTIONS = {
          preserveParagraphs: true,
          preserveHeadings: true,
          preserveLists: true,
          preserveEmphasis: false,
          convertToMarkdown: false,
          maxLineLength: 0,
          // 0 means no line wrapping
          indentSize: 2
        };
        /**
         * Convert HTML to well-formatted plain text
         */
        static htmlToText(html, options = {}) {
          if (!html || typeof html !== "string") {
            return "";
          }
          const opts = { ...this.DEFAULT_OPTIONS, ...options };
          try {
            let text = html;
            if (opts.convertToMarkdown) {
              text = this.htmlToMarkdown(text, opts);
            } else {
              text = this.htmlToPlainText(text, opts);
            }
            text = this.cleanupWhitespace(text);
            if (opts.maxLineLength && opts.maxLineLength > 0) {
              text = this.wrapLines(text, opts.maxLineLength);
            }
            return text;
          } catch (error) {
            ztoolkit.log(`[TextFormatter] Error formatting text: ${error}`, "error");
            return html.replace(/<[^>]*>/g, "").trim();
          }
        }
        /**
         * Convert HTML to Markdown format
         */
        static htmlToMarkdown(html, options) {
          let text = html;
          if (options.preserveHeadings) {
            text = text.replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi, (match, level, content) => {
              const hashes = "#".repeat(parseInt(level));
              const cleanContent = this.stripTags(content).trim();
              return `

${hashes} ${cleanContent}

`;
            });
          }
          if (options.preserveEmphasis) {
            text = text.replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, "**$2**");
            text = text.replace(/<(em|i)[^>]*>(.*?)<\/\1>/gi, "*$2*");
          }
          if (options.preserveLists) {
            text = text.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
              let counter = 1;
              const listContent = content.replace(/<li[^>]*>(.*?)<\/li>/gi, (liMatch, liContent) => {
                const cleanContent = this.stripTags(liContent).trim();
                return `${counter++}. ${cleanContent}
`;
              });
              return `
${listContent}
`;
            });
            text = text.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
              const listContent = content.replace(/<li[^>]*>(.*?)<\/li>/gi, (liMatch, liContent) => {
                const cleanContent = this.stripTags(liContent).trim();
                return `\u2022 ${cleanContent}
`;
              });
              return `
${listContent}
`;
            });
          }
          if (options.preserveParagraphs) {
            text = text.replace(/<\/p>/gi, "\n\n");
            text = text.replace(/<p[^>]*>/gi, "");
          }
          text = text.replace(/<br\s*\/?>/gi, "\n");
          text = text.replace(/<\/(div|section|article|header|footer|nav|blockquote)>/gi, "\n\n");
          text = text.replace(/<(div|section|article|header|footer|nav|blockquote)[^>]*>/gi, "");
          text = this.stripTags(text);
          return text;
        }
        /**
         * Convert HTML to plain text with preserved structure
         */
        static htmlToPlainText(html, options) {
          let text = html;
          if (options.preserveHeadings) {
            text = text.replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi, (match, level, content) => {
              const cleanContent = this.stripTags(content).trim();
              const indent = "=".repeat(Math.max(1, 7 - parseInt(level)));
              return `

${indent} ${cleanContent.toUpperCase()} ${indent}

`;
            });
          }
          if (options.preserveLists) {
            text = text.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
              let counter = 1;
              const listContent = content.replace(/<li[^>]*>(.*?)<\/li>/gi, (liMatch, liContent) => {
                const cleanContent = this.stripTags(liContent).trim();
                const indent = " ".repeat(options.indentSize || 2);
                return `
${indent}${counter++}. ${cleanContent}`;
              });
              return `
${listContent}

`;
            });
            text = text.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
              const listContent = content.replace(/<li[^>]*>(.*?)<\/li>/gi, (liMatch, liContent) => {
                const cleanContent = this.stripTags(liContent).trim();
                const indent = " ".repeat(options.indentSize || 2);
                return `
${indent}\u2022 ${cleanContent}`;
              });
              return `
${listContent}

`;
            });
          }
          if (options.preserveParagraphs) {
            text = text.replace(/<\/p>/gi, "\n\n");
            text = text.replace(/<p[^>]*>/gi, "");
          }
          text = text.replace(/<br\s*\/?>/gi, "\n");
          text = text.replace(/<\/(div|section|article|header|footer|nav)>/gi, "\n\n");
          text = text.replace(/<(div|section|article|header|footer|nav)[^>]*>/gi, "");
          text = text.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (match, content) => {
            const cleanContent = this.stripTags(content).trim();
            const indent = " ".repeat(options.indentSize || 2);
            const indentedText = cleanContent.split("\n").map(
              (line) => line.trim() ? `${indent}> ${line.trim()}` : ""
            ).join("\n");
            return `

${indentedText}

`;
          });
          text = this.stripTags(text);
          return text;
        }
        /**
         * Clean up whitespace while preserving intentional formatting
         */
        static cleanupWhitespace(text) {
          return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n{4,}/g, "\n\n\n").replace(/[ \t]+$/gm, "").replace(/^[ \t]+(?=[^ \t>•\d])/gm, "").replace(/[ \t]{3,}/g, "  ").replace(/\s+([,.!?;:])/g, "$1").replace(/([,.!?;:])\s{2,}/g, "$1 ").trim();
        }
        /**
         * Wrap long lines while preserving structure
         */
        static wrapLines(text, maxLength) {
          return text.split("\n").map((line) => {
            if (line.length <= maxLength) return line;
            if (/^[=\-#•>\d.]|\s+[•>\d]/.test(line)) return line;
            const words = line.split(" ");
            const wrappedLines = [];
            let currentLine = "";
            for (const word of words) {
              if (currentLine.length + word.length + 1 <= maxLength) {
                currentLine += (currentLine ? " " : "") + word;
              } else {
                if (currentLine) wrappedLines.push(currentLine);
                currentLine = word;
              }
            }
            if (currentLine) wrappedLines.push(currentLine);
            return wrappedLines.join("\n");
          }).join("\n");
        }
        /**
         * Remove HTML tags while preserving content
         */
        static stripTags(html) {
          return html.replace(/<[^>]*>/g, "");
        }
        /**
         * Format raw PDF text by fixing common PDF extraction issues
         */
        static formatPDFText(rawText) {
          if (!rawText || typeof rawText !== "string") {
            return "";
          }
          try {
            let text = rawText;
            text = text.replace(/(\w)-\n(\w)/g, "$1$2");
            text = text.replace(/(\w)\n(\w)/g, "$1 $2");
            text = text.replace(/\t/g, " ");
            text = text.replace(/ {3,}/g, "  ");
            text = text.replace(/\n\n+/g, "\xB6\xB6");
            text = text.replace(/\n/g, " ");
            text = text.replace(/¶¶/g, "\n\n");
            text = text.replace(/\f/g, "\n\n");
            text = text.replace(/[\u00A0\u2000-\u200B\u2028\u2029]/g, " ");
            const lines = text.split("\n");
            if (lines.length > 10) {
              const lineFreq = {};
              lines.forEach((line) => {
                const cleanLine = line.trim();
                if (cleanLine.length > 5 && cleanLine.length < 100) {
                  lineFreq[cleanLine] = (lineFreq[cleanLine] || 0) + 1;
                }
              });
              const filteredLines = lines.filter((line) => {
                const cleanLine = line.trim();
                return !lineFreq[cleanLine] || lineFreq[cleanLine] <= 3;
              });
              if (filteredLines.length < lines.length * 0.9) {
                text = filteredLines.join("\n");
              }
            }
            text = this.cleanupWhitespace(text);
            return text;
          } catch (error) {
            ztoolkit.log(`[TextFormatter] Error formatting PDF text: ${error}`, "error");
            return rawText.trim();
          }
        }
        /**
         * Smart truncation that preserves paragraph boundaries
         */
        static smartTruncate(text, maxLength) {
          if (text.length <= maxLength) return text;
          const paragraphs = text.split("\n\n");
          let result = "";
          for (const paragraph of paragraphs) {
            if (result.length + paragraph.length + 2 <= maxLength) {
              result += (result ? "\n\n" : "") + paragraph;
            } else {
              if (result.length < maxLength * 0.8) {
                const sentences = paragraph.split(/[.!?]+\s/);
                for (const sentence of sentences) {
                  if (result.length + sentence.length + 2 <= maxLength) {
                    result += (result ? "\n\n" : "") + sentence + ".";
                  } else {
                    break;
                  }
                }
              }
              break;
            }
          }
          if (result.length > maxLength) {
            const words = result.split(" ");
            result = "";
            for (const word of words) {
              if (result.length + word.length + 1 <= maxLength) {
                result += (result ? " " : "") + word;
              } else {
                break;
              }
            }
          }
          return result.trim();
        }
      };
    }
  });

  // src/modules/fulltextService.ts
  var FulltextService, fulltextService;
  var init_fulltextService = __esm({
    "src/modules/fulltextService.ts"() {
      "use strict";
      FulltextService = class {
        /**
         * Get comprehensive fulltext content for an item
         * @param itemKey - The item key
         * @returns Object containing all available text content
         */
        async getItemFulltext(itemKey) {
          try {
            const item = Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, itemKey);
            if (!item) {
              throw new Error(`Item with key ${itemKey} not found`);
            }
            ztoolkit.log(`[FulltextService] Getting fulltext for item ${itemKey}`);
            const result = {
              itemKey,
              title: item.getDisplayTitle(),
              itemType: item.itemType,
              abstract: this.getItemAbstract(item),
              fulltext: {
                attachments: [],
                notes: [],
                webpage: null,
                total_length: 0
              },
              metadata: {
                extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
                sources: []
              }
            };
            const attachments = item.getAttachments();
            for (const attachmentID of attachments) {
              try {
                const attachment = Zotero.Items.get(attachmentID);
                const attachmentText = await this.getAttachmentContent(attachment);
                if (attachmentText && attachmentText.content) {
                  result.fulltext.attachments.push(attachmentText);
                  result.fulltext.total_length += attachmentText.content.length;
                  result.metadata.sources.push(attachmentText.type);
                }
              } catch (error) {
                ztoolkit.log(`[FulltextService] Error extracting attachment ${attachmentID}: ${error}`, "warn");
              }
            }
            const notes = item.getNotes();
            for (const noteID of notes) {
              try {
                const note = Zotero.Items.get(noteID);
                const noteContent = this.getNoteContent(note);
                if (noteContent) {
                  result.fulltext.notes.push(noteContent);
                  result.fulltext.total_length += noteContent.content.length;
                }
              } catch (error) {
                ztoolkit.log(`[FulltextService] Error extracting note ${noteID}: ${error}`, "warn");
              }
            }
            const webpageContent = await this.getWebpageContent(item);
            if (webpageContent) {
              result.fulltext.webpage = webpageContent;
              result.fulltext.total_length += webpageContent.content.length;
              result.metadata.sources.push("webpage");
            }
            ztoolkit.log(`[FulltextService] Extracted ${result.fulltext.total_length} characters from ${result.metadata.sources.length} sources`);
            return result;
          } catch (error) {
            ztoolkit.log(`[FulltextService] Error in getItemFulltext: ${error}`, "error");
            throw error;
          }
        }
        /**
         * Get content from a specific attachment
         * @param attachment - Zotero attachment item
         * @returns Object with attachment content and metadata
         */
        async getAttachmentContent(attachment) {
          if (!attachment || !attachment.isAttachment()) {
            return null;
          }
          try {
            const attachmentType = attachment.attachmentContentType;
            const filename = attachment.attachmentFilename;
            const path = attachment.getFilePath();
            ztoolkit.log(`[FulltextService] Processing attachment: ${filename} (${attachmentType})`);
            let content = "";
            let extractionMethod = "unknown";
            if (this.isPDFAttachment(attachment, attachmentType)) {
              try {
                const { PDFProcessor: PDFProcessor2 } = await Promise.resolve().then(() => (init_pdfProcessor(), pdfProcessor_exports));
                const { TextFormatter: TextFormatter2 } = await Promise.resolve().then(() => (init_textFormatter(), textFormatter_exports));
                const processor = new PDFProcessor2(ztoolkit);
                const filePath = attachment.getFilePath();
                if (filePath) {
                  try {
                    const rawText = await processor.extractText(filePath);
                    content = TextFormatter2.formatPDFText(rawText);
                    extractionMethod = "pdf_processor";
                  } catch (fileError) {
                    ztoolkit.log(`[FulltextService] PDF file not accessible at path: ${filePath} - ${fileError}`, "warn");
                  } finally {
                    processor.terminate();
                  }
                } else {
                  ztoolkit.log(`[FulltextService] No file path available for PDF attachment ${attachment.key}`, "warn");
                }
              } catch (pdfError) {
                ztoolkit.log(`[FulltextService] PDF extraction failed for ${attachment.key}: ${pdfError}`, "warn");
                content = "";
              }
            } else if (attachmentType && (attachmentType.includes("html") || attachmentType.includes("text") || attachmentType.includes("xml"))) {
              content = await this.extractTextFromFile(path, attachmentType);
              extractionMethod = "file_reading";
            } else if (attachment.isWebAttachment()) {
              content = await this.extractWebAttachmentContent(attachment);
              extractionMethod = "web_extraction";
            } else {
              const fulltextContent = await this.getZoteroFulltext(attachment);
              if (fulltextContent) {
                content = fulltextContent;
                extractionMethod = "zotero_builtin";
              }
            }
            if (!content || content.trim().length === 0) {
              return null;
            }
            return {
              attachmentKey: attachment.key,
              filename,
              filePath: path || attachment.getFilePath(),
              contentType: attachmentType,
              type: this.categorizeAttachmentType(attachmentType),
              content: content.trim(),
              length: content.length,
              extractionMethod,
              extractedAt: (/* @__PURE__ */ new Date()).toISOString()
            };
          } catch (error) {
            ztoolkit.log(`[FulltextService] Error extracting attachment content: ${error}`, "error");
            return null;
          }
        }
        /**
         * Get item abstract
         * @param item - Zotero item
         * @returns Abstract text or null
         */
        getItemAbstract(item) {
          try {
            const abstract = item.getField("abstractNote");
            return abstract && abstract.trim().length > 0 ? abstract.trim() : null;
          } catch (error) {
            return null;
          }
        }
        /**
         * Get note content
         * @param note - Zotero note item
         * @returns Note content object
         */
        getNoteContent(note) {
          try {
            if (!note || !note.isNote()) {
              return null;
            }
            const noteText = note.getNote();
            if (!noteText || noteText.trim().length === 0) {
              return null;
            }
            const plainText = noteText.replace(/<[^>]*>/g, "").trim();
            return {
              noteKey: note.key,
              title: note.getNoteTitle() || "Untitled Note",
              content: plainText,
              htmlContent: noteText,
              length: plainText.length,
              dateModified: note.dateModified,
              type: "note"
            };
          } catch (error) {
            ztoolkit.log(`[FulltextService] Error extracting note content: ${error}`, "error");
            return null;
          }
        }
        /**
         * Get webpage content from snapshots
         * @param item - Zotero item
         * @returns Webpage content or null
         */
        async getWebpageContent(item) {
          try {
            const url = item.getField("url");
            if (!url) {
              return null;
            }
            const attachments = item.getAttachments();
            for (const attachmentID of attachments) {
              const attachment = Zotero.Items.get(attachmentID);
              if (attachment.attachmentContentType && attachment.attachmentContentType.includes("html")) {
                const content = await this.extractTextFromFile(attachment.getFilePath(), "text/html");
                if (content && content.length > 0) {
                  return {
                    url,
                    filename: attachment.attachmentFilename,
                    filePath: attachment.getFilePath(),
                    content: content.trim(),
                    length: content.length,
                    type: "webpage_snapshot",
                    extractedAt: (/* @__PURE__ */ new Date()).toISOString()
                  };
                }
              }
            }
            return null;
          } catch (error) {
            ztoolkit.log(`[FulltextService] Error extracting webpage content: ${error}`, "error");
            return null;
          }
        }
        /**
         * Search within fulltext content
         * @param query - Search query
         * @param options - Search options
         * @returns Search results with context
         */
        async searchFulltext(query, options = {}) {
          try {
            const {
              itemKeys = null,
              contextLength = 200,
              maxResults = 50,
              caseSensitive = false
            } = options;
            ztoolkit.log(`[FulltextService] Searching fulltext for: "${query}"`);
            const results = [];
            const searchRegex = new RegExp(
              query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              caseSensitive ? "g" : "gi"
            );
            let itemsToSearch;
            if (itemKeys && Array.isArray(itemKeys)) {
              itemsToSearch = itemKeys.map(
                (key) => Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, key)
              ).filter((item) => item);
            } else {
              const allItems = await Zotero.Items.getAll(Zotero.Libraries.userLibraryID);
              itemsToSearch = allItems.slice(0, 1e3);
            }
            for (const item of itemsToSearch) {
              if (results.length >= maxResults) break;
              try {
                const fulltext = await this.getItemFulltext(item.key);
                const matches = [];
                const searchSources = [
                  { content: fulltext.abstract, type: "abstract" },
                  ...fulltext.fulltext.attachments.map((att) => ({ content: att.content, type: "attachment", filename: att.filename })),
                  ...fulltext.fulltext.notes.map((note) => ({ content: note.content, type: "note", title: note.title }))
                ];
                if (fulltext.fulltext.webpage) {
                  searchSources.push({ content: fulltext.fulltext.webpage.content, type: "webpage" });
                }
                for (const source of searchSources) {
                  if (!source.content) continue;
                  const sourceMatches = [...source.content.matchAll(searchRegex)];
                  for (const match of sourceMatches) {
                    const startPos = Math.max(0, match.index - contextLength);
                    const endPos = Math.min(source.content.length, match.index + match[0].length + contextLength);
                    const context = source.content.substring(startPos, endPos);
                    matches.push({
                      type: source.type,
                      filename: source.filename || source.title || null,
                      match: match[0],
                      context: context.trim(),
                      position: match.index
                    });
                  }
                }
                if (matches.length > 0) {
                  results.push({
                    itemKey: item.key,
                    title: item.getDisplayTitle(),
                    itemType: item.itemType,
                    totalMatches: matches.length,
                    matches: matches.slice(0, 10),
                    // Limit matches per item
                    relevanceScore: matches.length
                  });
                }
              } catch (error) {
                ztoolkit.log(`[FulltextService] Error searching item ${item.key}: ${error}`, "warn");
              }
            }
            results.sort((a, b) => b.relevanceScore - a.relevanceScore);
            return {
              query,
              totalResults: results.length,
              results: results.slice(0, maxResults),
              searchOptions: options,
              searchedAt: (/* @__PURE__ */ new Date()).toISOString()
            };
          } catch (error) {
            ztoolkit.log(`[FulltextService] Error in searchFulltext: ${error}`, "error");
            throw error;
          }
        }
        /**
         * Extract text from file based on content type
         * @param filePath - Path to file
         * @param contentType - MIME content type
         * @returns Extracted text content
         */
        async extractTextFromFile(filePath, contentType) {
          try {
            if (!filePath) {
              return "";
            }
            if (contentType.includes("html") || contentType.includes("xml")) {
              const htmlContent = await Zotero.File.getContentsAsync(filePath);
              return htmlContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
            } else if (contentType.includes("text")) {
              return await Zotero.File.getContentsAsync(filePath);
            }
            return "";
          } catch (error) {
            ztoolkit.log(`[FulltextService] Error reading file ${filePath}: ${error}`, "error");
            return "";
          }
        }
        /**
         * Extract content from web attachments
         * @param attachment - Web attachment item
         * @returns Extracted content
         */
        async extractWebAttachmentContent(attachment) {
          try {
            const url = attachment.getField("url");
            if (!url) return "";
            const filePath = attachment.getFilePath();
            if (filePath) {
              try {
                return await this.extractTextFromFile(filePath, "text/html");
              } catch (error) {
                ztoolkit.log(`[FulltextService] Could not read web attachment file: ${filePath} - ${error}`, "warn");
              }
            }
            return "";
          } catch (error) {
            ztoolkit.log(`[FulltextService] Error extracting web attachment: ${error}`, "error");
            return "";
          }
        }
        /**
         * Use Zotero's built-in fulltext extraction
         * @param attachment - Attachment item
         * @returns Fulltext content or null
         */
        async getZoteroFulltext(attachment) {
          try {
            if (Zotero.Fulltext && Zotero.Fulltext.getItemContent) {
              const content = await Zotero.Fulltext.getItemContent(attachment.id);
              return content && content.content ? content.content : null;
            }
            return null;
          } catch (error) {
            ztoolkit.log(`[FulltextService] Error using Zotero fulltext: ${error}`, "warn");
            return null;
          }
        }
        /**
         * Check if attachment is a PDF file
         * @param attachment - Attachment item
         * @param contentType - MIME content type
         * @returns True if attachment is PDF
         */
        isPDFAttachment(attachment, contentType) {
          if (contentType && contentType.includes("pdf")) {
            return true;
          }
          const filename = attachment.attachmentFilename || "";
          if (filename.toLowerCase().endsWith(".pdf")) {
            return true;
          }
          const path = attachment.getFilePath() || "";
          if (path.toLowerCase().endsWith(".pdf")) {
            return true;
          }
          return false;
        }
        /**
         * Categorize attachment type for better organization
         * @param contentType - MIME content type
         * @returns Category string
         */
        categorizeAttachmentType(contentType) {
          if (!contentType) return "unknown";
          if (contentType.includes("pdf")) return "pdf";
          if (contentType.includes("html")) return "html";
          if (contentType.includes("text")) return "text";
          if (contentType.includes("word") || contentType.includes("document")) return "document";
          if (contentType.includes("image")) return "image";
          if (contentType.includes("xml")) return "xml";
          return "other";
        }
      };
      fulltextService = new FulltextService();
    }
  });

  // src/modules/apiHandlers.ts
  var apiHandlers_exports = {};
  __export(apiHandlers_exports, {
    handleGetCollectionDetails: () => handleGetCollectionDetails,
    handleGetCollectionItems: () => handleGetCollectionItems,
    handleGetCollections: () => handleGetCollections,
    handleGetItem: () => handleGetItem,
    handleGetItemAbstract: () => handleGetItemAbstract,
    handleGetItemAnnotations: () => handleGetItemAnnotations,
    handleGetItemNotes: () => handleGetItemNotes,
    handleGetSubcollections: () => handleGetSubcollections,
    handlePing: () => handlePing,
    handleSearch: () => handleSearch,
    handleSearchCollections: () => handleSearchCollections,
    handleSearchFulltext: () => handleSearchFulltext
  });
  async function handlePing() {
    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        message: "pong",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      })
    };
  }
  async function handleGetItem(params, query) {
    const itemKey = params[1];
    if (!itemKey) {
      return {
        status: 400,
        statusText: "Bad Request",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "Missing itemKey parameter" })
      };
    }
    try {
      const item = Zotero.Items.getByLibraryAndKey(
        Zotero.Libraries.userLibraryID,
        itemKey
      );
      if (!item) {
        return {
          status: 404,
          statusText: "Not Found",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ error: `Item with key ${itemKey} not found` })
        };
      }
      const fieldsParam = query.get("fields");
      const fields = fieldsParam ? fieldsParam.split(",") : void 0;
      const formattedItem = await formatItem(item, fields);
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(formattedItem)
      };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      Zotero.logError(error);
      return {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "An unexpected error occurred" })
      };
    }
  }
  async function handleSearch(query) {
    ztoolkit.log("[MCP ApiHandlers] handleSearch called");
    try {
      const searchParams = {};
      for (const [key, value] of query.entries()) {
        if (key === "tags") {
          searchParams[key] = value.split(",").map((t) => t.trim()).filter(Boolean);
        } else {
          searchParams[key] = value;
        }
      }
      if (searchParams.tag && !searchParams.tags) {
        searchParams.tags = [searchParams.tag];
      }
      if (searchParams.tags) {
        searchParams.tagMode = searchParams.tagMode || "any";
        searchParams.tagMatch = searchParams.tagMatch || "exact";
      }
      ztoolkit.log(
        `[MCP ApiHandlers] Converted search params: ${JSON.stringify(searchParams)}`
      );
      const searchResult = await handleSearchRequest(searchParams);
      ztoolkit.log(
        `[MCP ApiHandlers] Search engine returned ${searchResult.results?.length || 0} results`
      );
      const response = {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(searchResult)
      };
      ztoolkit.log(
        `[MCP ApiHandlers] Returning response with body length: ${response.body.length}`
      );
      return response;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      ztoolkit.log(
        `[MCP ApiHandlers] Error in handleSearch: ${error.message}`,
        "error"
      );
      ztoolkit.log(`[MCP ApiHandlers] Error stack: ${error.stack}`, "error");
      Zotero.logError(error);
      const status = error.status || 500;
      const errorResponse = {
        status,
        statusText: status === 400 ? "Bad Request" : "Internal Server Error",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: error.message })
      };
      ztoolkit.log(
        `[MCP ApiHandlers] Returning error response: ${errorResponse.status} ${errorResponse.statusText}`,
        "error"
      );
      return errorResponse;
    }
  }
  async function handleGetCollections(query) {
    try {
      const libraryID = parseInt(query.get("libraryID") || "", 10) || Zotero.Libraries.userLibraryID;
      const limit = parseInt(query.get("limit") || "100", 10);
      const offset = parseInt(query.get("offset") || "0", 10);
      const sort = query.get("sort") || "name";
      const direction = query.get("direction") || "asc";
      const includeSubcollections = query.get("includeSubcollections") === "true";
      const parentCollection = query.get("parentCollection");
      let collectionIDs;
      if (parentCollection) {
        const parent = Zotero.Collections.getByLibraryAndKey(
          libraryID,
          parentCollection
        );
        if (!parent) {
          return {
            status: 404,
            statusText: "Not Found",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({
              error: `Parent collection ${parentCollection} not found`
            })
          };
        }
        collectionIDs = parent.getChildCollections(true);
      } else {
        collectionIDs = Zotero.Collections.getByLibrary(libraryID).map(
          (c) => c.id
        );
      }
      const collections = Zotero.Collections.get(
        collectionIDs
      );
      collections.sort((a, b) => {
        const aVal = a[sort] || "";
        const bVal = b[sort] || "";
        if (aVal < bVal) return direction === "asc" ? -1 : 1;
        if (aVal > bVal) return direction === "asc" ? 1 : -1;
        return 0;
      });
      const total = collections.length;
      const paginated = collections.slice(offset, offset + limit);
      return {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-Total-Count": total.toString()
        },
        body: JSON.stringify(formatCollectionList(paginated))
      };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      Zotero.logError(error);
      return {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "An unexpected error occurred" })
      };
    }
  }
  async function handleSearchCollections(query) {
    try {
      const q = query.get("q");
      if (!q) {
        return {
          status: 400,
          statusText: "Bad Request",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ error: "Missing query parameter 'q'" })
        };
      }
      const libraryID = parseInt(query.get("libraryID") || "", 10) || Zotero.Libraries.userLibraryID;
      const limit = parseInt(query.get("limit") || "100", 10);
      const offset = parseInt(query.get("offset") || "0", 10);
      const allCollections = Zotero.Collections.getByLibrary(libraryID) || [];
      const lowerCaseQuery = q.toLowerCase();
      const matchedCollections = allCollections.filter(
        (collection) => collection.name.toLowerCase().includes(lowerCaseQuery)
      );
      const collections = matchedCollections;
      const total = collections.length;
      const paginated = collections.slice(offset, offset + limit);
      return {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-Total-Count": total.toString()
        },
        body: JSON.stringify(formatCollectionList(paginated))
      };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      Zotero.logError(error);
      return {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "An unexpected error occurred" })
      };
    }
  }
  async function handleGetCollectionDetails(params, query) {
    try {
      const collectionKey = params[1];
      if (!collectionKey) {
        return {
          status: 400,
          statusText: "Bad Request",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ error: "Missing collectionKey parameter" })
        };
      }
      const libraryID = parseInt(query.get("libraryID") || "", 10) || Zotero.Libraries.userLibraryID;
      const collection = Zotero.Collections.getByLibraryAndKey(
        libraryID,
        collectionKey
      );
      if (!collection) {
        return {
          status: 404,
          statusText: "Not Found",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            error: `Collection with key ${collectionKey} not found`
          })
        };
      }
      const options = {
        includeItems: query.get("includeItems") === "true",
        includeSubcollections: query.get("includeSubcollections") === "true",
        itemsLimit: parseInt(query.get("itemsLimit") || "50", 10)
      };
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(formatCollectionDetails(collection, options))
      };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      Zotero.logError(error);
      return {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "An unexpected error occurred" })
      };
    }
  }
  async function handleGetCollectionItems(params, query) {
    try {
      const collectionKey = params[1];
      ztoolkit.log(`[ApiHandlers] Getting collection items for key: ${collectionKey}`);
      if (!collectionKey) {
        return {
          status: 400,
          statusText: "Bad Request",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ error: "Missing collectionKey parameter" })
        };
      }
      const libraryID = parseInt(query.get("libraryID") || "", 10) || Zotero.Libraries.userLibraryID;
      ztoolkit.log(`[ApiHandlers] Using libraryID: ${libraryID}`);
      const collection = Zotero.Collections.getByLibraryAndKey(
        libraryID,
        collectionKey
      );
      if (!collection) {
        ztoolkit.log(`[ApiHandlers] Collection not found: ${collectionKey} in library ${libraryID}`, "error");
        return {
          status: 404,
          statusText: "Not Found",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            error: `Collection with key ${collectionKey} not found`
          })
        };
      }
      ztoolkit.log(`[ApiHandlers] Found collection: ${collection.name}`);
      const limit = parseInt(query.get("limit") || "100", 10);
      const offset = parseInt(query.get("offset") || "0", 10);
      const fields = query.get("fields")?.split(",");
      ztoolkit.log(`[ApiHandlers] Pagination: limit=${limit}, offset=${offset}`);
      ztoolkit.log(`[ApiHandlers] Fields requested: ${fields?.join(", ") || "default"}`);
      const itemIDs = collection.getChildItems(true);
      const total = itemIDs.length;
      ztoolkit.log(`[ApiHandlers] Collection contains ${total} items, IDs: [${itemIDs.slice(0, 5).join(", ")}${itemIDs.length > 5 ? "..." : ""}]`);
      const paginatedIDs = itemIDs.slice(offset, offset + limit);
      ztoolkit.log(`[ApiHandlers] Paginated IDs: [${paginatedIDs.join(", ")}]`);
      const items = Zotero.Items.get(paginatedIDs);
      ztoolkit.log(`[ApiHandlers] Retrieved ${items.length} item objects from Zotero`);
      ztoolkit.log(`[ApiHandlers] Starting formatItems...`);
      const formattedItems = await formatItems(items, fields);
      ztoolkit.log(`[ApiHandlers] Formatted ${formattedItems.length} items`);
      return {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-Total-Count": total.toString()
        },
        body: JSON.stringify(formattedItems)
      };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      ztoolkit.log(`[ApiHandlers] Error in handleGetCollectionItems: ${error.message}`, "error");
      ztoolkit.log(`[ApiHandlers] Error stack: ${error.stack}`, "error");
      Zotero.logError(error);
      return {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "An unexpected error occurred" })
      };
    }
  }
  async function handleGetSubcollections(params, query) {
    try {
      const collectionKey = params[1];
      ztoolkit.log(`[ApiHandlers] Getting subcollections for key: ${collectionKey}`);
      if (!collectionKey) {
        return {
          status: 400,
          statusText: "Bad Request",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ error: "Missing collectionKey parameter" })
        };
      }
      const libraryID = parseInt(query.get("libraryID") || "", 10) || Zotero.Libraries.userLibraryID;
      ztoolkit.log(`[ApiHandlers] Using libraryID: ${libraryID}`);
      const collection = Zotero.Collections.getByLibraryAndKey(
        libraryID,
        collectionKey
      );
      if (!collection) {
        ztoolkit.log(`[ApiHandlers] Collection not found: ${collectionKey} in library ${libraryID}`, "error");
        return {
          status: 404,
          statusText: "Not Found",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            error: `Collection with key ${collectionKey} not found`
          })
        };
      }
      ztoolkit.log(`[ApiHandlers] Found collection: ${collection.name}`);
      const limit = parseInt(query.get("limit") || "100", 10);
      const offset = parseInt(query.get("offset") || "0", 10);
      const includeRecursive = query.get("recursive") === "true";
      ztoolkit.log(`[ApiHandlers] Pagination: limit=${limit}, offset=${offset}, recursive=${includeRecursive}`);
      const subcollectionIDs = collection.getChildCollections(true, false);
      const total = subcollectionIDs.length;
      ztoolkit.log(`[ApiHandlers] Collection contains ${total} subcollections, IDs: [${subcollectionIDs.slice(0, 5).join(", ")}${subcollectionIDs.length > 5 ? "..." : ""}]`);
      const paginatedIDs = subcollectionIDs.slice(offset, offset + limit);
      ztoolkit.log(`[ApiHandlers] Paginated IDs: [${paginatedIDs.join(", ")}]`);
      const subcollections = Zotero.Collections.get(paginatedIDs);
      ztoolkit.log(`[ApiHandlers] Retrieved ${subcollections.length} subcollection objects from Zotero`);
      const formattedSubcollections = formatCollectionList(subcollections);
      if (includeRecursive) {
        const enrichedSubcollections = formattedSubcollections.map((sc) => {
          const fullCollection = subcollections.find((c) => c.key === sc.key);
          if (fullCollection) {
            const childCount = fullCollection.getChildCollections(true, false).length;
            return {
              ...sc,
              numSubcollections: childCount
            };
          }
          return sc;
        });
        return {
          status: 200,
          statusText: "OK",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "X-Total-Count": total.toString()
          },
          body: JSON.stringify(enrichedSubcollections)
        };
      }
      ztoolkit.log(`[ApiHandlers] Formatted ${formattedSubcollections.length} subcollections`);
      return {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-Total-Count": total.toString()
        },
        body: JSON.stringify(formattedSubcollections)
      };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      ztoolkit.log(`[ApiHandlers] Error in handleGetSubcollections: ${error.message}`, "error");
      ztoolkit.log(`[ApiHandlers] Error stack: ${error.stack}`, "error");
      Zotero.logError(error);
      return {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "An unexpected error occurred" })
      };
    }
  }
  async function handleGetItemNotes(params, query) {
    const itemKey = params[1];
    if (!itemKey) {
      return {
        status: 400,
        statusText: "Bad Request",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "Missing itemKey parameter" })
      };
    }
    ztoolkit.log(`[MCP ApiHandlers] Getting notes for item ${itemKey}`);
    try {
      const allNotes = [];
      const limit = Math.min(parseInt(query.get("limit") || "20", 10), 100);
      const offset = parseInt(query.get("offset") || "0", 10);
      const totalCount = allNotes.length;
      const paginatedNotes = allNotes.slice(offset, offset + limit);
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          // 元数据在前
          pagination: {
            limit,
            offset,
            total: totalCount,
            hasMore: offset + limit < totalCount
          },
          totalCount,
          version: "2.0",
          endpoint: "items/notes",
          itemKey,
          // 数据在后
          notes: paginatedNotes
        })
      };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      ztoolkit.log(
        `[MCP ApiHandlers] Error in handleGetItemNotes: ${error.message}`,
        "error"
      );
      Zotero.logError(error);
      if (error.message.includes("not found")) {
        return {
          status: 404,
          statusText: "Not Found",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ error: error.message })
        };
      }
      return {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "An unexpected error occurred" })
      };
    }
  }
  async function handleGetItemAnnotations(params, query) {
    const itemKey = params[1];
    if (!itemKey) {
      return {
        status: 400,
        statusText: "Bad Request",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "Missing itemKey parameter" })
      };
    }
    ztoolkit.log(`[MCP ApiHandlers] Getting annotations for item ${itemKey}`);
    try {
      const annotations = [];
      let filteredAnnotations = annotations;
      const typeFilter = query.get("type");
      if (typeFilter) {
        const types = typeFilter.split(",").map((t) => t.trim());
        filteredAnnotations = annotations.filter(
          (ann) => types.includes(ann.type)
        );
      }
      const colorFilter = query.get("color");
      if (colorFilter) {
        filteredAnnotations = filteredAnnotations.filter(
          (ann) => ann.color === colorFilter
        );
      }
      const limit = Math.min(parseInt(query.get("limit") || "20", 10), 100);
      const offset = parseInt(query.get("offset") || "0", 10);
      const totalCount = filteredAnnotations.length;
      const paginatedAnnotations = filteredAnnotations.slice(offset, offset + limit);
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          // 元数据在前
          pagination: {
            limit,
            offset,
            total: totalCount,
            hasMore: offset + limit < totalCount
          },
          totalCount,
          version: "2.0",
          endpoint: "items/annotations",
          itemKey,
          // 数据在后
          annotations: paginatedAnnotations
        })
      };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      ztoolkit.log(
        `[MCP ApiHandlers] Error in handleGetItemAnnotations: ${error.message}`,
        "error"
      );
      Zotero.logError(error);
      if (error.message.includes("not found")) {
        return {
          status: 404,
          statusText: "Not Found",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ error: error.message })
        };
      }
      return {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "An unexpected error occurred" })
      };
    }
  }
  async function handleSearchFulltext(query) {
    const q = query.get("q");
    if (!q || q.trim().length === 0) {
      return {
        status: 400,
        statusText: "Bad Request",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "Missing query parameter 'q'" })
      };
    }
    ztoolkit.log(`[MCP ApiHandlers] Searching fulltext for: "${q}"`);
    try {
      const fulltextService2 = new FulltextService();
      const options = {
        itemKeys: query.get("itemKeys")?.split(",") || null,
        contextLength: parseInt(query.get("contextLength") || "200", 10),
        maxResults: Math.min(parseInt(query.get("maxResults") || "50", 10), 200),
        caseSensitive: query.get("caseSensitive") === "true"
      };
      const searchResult = await fulltextService2.searchFulltext(q, options);
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(searchResult, null, 2)
      };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      ztoolkit.log(
        `[MCP ApiHandlers] Error in handleSearchFulltext: ${error.message}`,
        "error"
      );
      Zotero.logError(error);
      return {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "An unexpected error occurred" })
      };
    }
  }
  async function handleGetItemAbstract(params, query) {
    const itemKey = params[1];
    if (!itemKey) {
      return {
        status: 400,
        statusText: "Bad Request",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "Missing itemKey parameter" })
      };
    }
    ztoolkit.log(`[MCP ApiHandlers] Getting abstract for item ${itemKey}`);
    try {
      const item = Zotero.Items.getByLibraryAndKey(
        Zotero.Libraries.userLibraryID,
        itemKey
      );
      if (!item) {
        return {
          status: 404,
          statusText: "Not Found",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ error: `Item with key ${itemKey} not found` })
        };
      }
      const fulltextService2 = new FulltextService();
      const abstract = fulltextService2.getItemAbstract(item);
      if (!abstract) {
        return {
          status: 404,
          statusText: "Not Found",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ error: "No abstract found for this item" })
        };
      }
      const format = query.get("format") || "json";
      if (format === "text") {
        return {
          status: 200,
          statusText: "OK",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
          body: abstract
        };
      } else {
        return {
          status: 200,
          statusText: "OK",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            itemKey,
            title: item.getDisplayTitle(),
            abstract,
            length: abstract.length,
            extractedAt: (/* @__PURE__ */ new Date()).toISOString()
          }, null, 2)
        };
      }
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      ztoolkit.log(
        `[MCP ApiHandlers] Error in handleGetItemAbstract: ${error.message}`,
        "error"
      );
      Zotero.logError(error);
      return {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "An unexpected error occurred" })
      };
    }
  }
  var init_apiHandlers = __esm({
    "src/modules/apiHandlers.ts"() {
      "use strict";
      init_itemFormatter();
      init_collectionFormatter();
      init_searchEngine();
      init_fulltextService();
    }
  });

  // src/modules/mcpSettingsService.ts
  var MCPSettingsService;
  var init_mcpSettingsService = __esm({
    "src/modules/mcpSettingsService.ts"() {
      "use strict";
      MCPSettingsService = class {
        static PREF_PREFIX = "extensions.zotero.zotero-mcp-ext.";
        // Unified content processing modes - single, intuitive system
        static UNIFIED_MODES = {
          "minimal": {
            name: "\u6700\u5C0F\u6A21\u5F0F / Minimal",
            description: "\u6700\u5FEB\u901F\u5EA6\uFF0C\u6700\u5C11\u5185\u5BB9 (500\u5B57\u7B26)",
            maxContentLength: 500,
            maxAttachments: 2,
            maxNotes: 3,
            keywordCount: 2,
            smartTruncateLength: 100,
            searchItemLimit: 30,
            maxAnnotationsPerRequest: 15,
            includeWebpage: false,
            enableCompression: true
          },
          "preview": {
            name: "\u9884\u89C8\u6A21\u5F0F / Preview",
            description: "\u9002\u4E2D\u5185\u5BB9\uFF0C\u5FEB\u901F\u9884\u89C8 (1.5K\u5B57\u7B26)",
            maxContentLength: 1500,
            maxAttachments: 5,
            maxNotes: 8,
            keywordCount: 3,
            smartTruncateLength: 150,
            searchItemLimit: 50,
            maxAnnotationsPerRequest: 20,
            includeWebpage: false,
            enableCompression: true
          },
          "standard": {
            name: "\u6807\u51C6\u6A21\u5F0F / Standard",
            description: "\u5E73\u8861\u5904\u7406\uFF0C\u667A\u80FD\u5185\u5BB9 (3K\u5B57\u7B26)",
            maxContentLength: 3e3,
            maxAttachments: 10,
            maxNotes: 15,
            keywordCount: 5,
            smartTruncateLength: 200,
            searchItemLimit: 100,
            maxAnnotationsPerRequest: 50,
            includeWebpage: true,
            enableCompression: true
          },
          "complete": {
            name: "\u5B8C\u6574\u6A21\u5F0F / Complete",
            description: "\u6240\u6709\u5185\u5BB9\uFF0C\u65E0\u957F\u5EA6\u9650\u5236",
            maxContentLength: -1,
            maxAttachments: -1,
            maxNotes: -1,
            keywordCount: 20,
            smartTruncateLength: 1e3,
            searchItemLimit: 1e3,
            maxAnnotationsPerRequest: 200,
            includeWebpage: true,
            enableCompression: false
          }
        };
        // Simplified default settings with unified mode system
        static DEFAULTS = {
          "ai.maxTokens": 1e4,
          "ui.includeMetadata": true,
          // Unified content mode (replaces the old preset + output mode system)
          "content.mode": "standard",
          // minimal, preview, standard, complete, custom
          // Custom mode settings (only used when mode is 'custom')
          "custom.maxContentLength": 3e3,
          "custom.maxAttachments": 10,
          "custom.maxNotes": 15,
          "custom.keywordCount": 5,
          "custom.smartTruncateLength": 200,
          "custom.searchItemLimit": 100,
          "custom.maxAnnotationsPerRequest": 50,
          "custom.includeWebpage": true,
          "custom.enableCompression": true,
          // Text formatting options
          "text.preserveFormatting": true,
          "text.preserveHeadings": true,
          "text.preserveLists": true,
          "text.preserveEmphasis": false
        };
        /**
         * Initialize default settings (called during plugin startup)
         */
        static initializeDefaults() {
          try {
            Object.entries(this.DEFAULTS).forEach(([key, value]) => {
              const prefKey = this.PREF_PREFIX + key;
              const currentValue = Zotero.Prefs.get(prefKey, true);
              if (currentValue === void 0 || currentValue === null) {
                Zotero.Prefs.set(prefKey, value, true);
                ztoolkit.log(`[MCPSettings] Set default ${key} = ${value}`);
              }
            });
            ztoolkit.log(`[MCPSettings] Default settings initialized`);
          } catch (error) {
            ztoolkit.log(`[MCPSettings] Error initializing defaults: ${error}`, "error");
          }
        }
        /**
         * Get a setting value
         */
        static get(key) {
          try {
            const prefKey = this.PREF_PREFIX + key;
            const defaultValue = this.DEFAULTS[key];
            const value = Zotero.Prefs.get(prefKey, true);
            return value !== void 0 && value !== null ? value : defaultValue;
          } catch (error) {
            ztoolkit.log(`[MCPSettings] Error getting setting ${key}: ${error}`, "error");
            return this.DEFAULTS[key];
          }
        }
        /**
         * Set a setting value
         */
        static set(key, value) {
          try {
            const prefKey = this.PREF_PREFIX + key;
            const validationResult = this.validateSetting(key, value);
            if (!validationResult.valid) {
              throw new Error(`Invalid value for ${key}: ${validationResult.error}`);
            }
            Zotero.Prefs.set(prefKey, value, true);
            ztoolkit.log(`[MCPSettings] Set ${key} = ${value}`);
          } catch (error) {
            ztoolkit.log(`[MCPSettings] Error setting ${key}: ${error}`, "error");
            throw error;
          }
        }
        /**
         * Get all current settings
         */
        static getAllSettings() {
          const effectiveSettings = this.getEffectiveSettings();
          return {
            ai: {
              maxTokens: this.get("ai.maxTokens")
            },
            content: {
              mode: this.get("content.mode")
            },
            custom: {
              maxContentLength: this.get("custom.maxContentLength"),
              maxAttachments: this.get("custom.maxAttachments"),
              maxNotes: this.get("custom.maxNotes"),
              keywordCount: this.get("custom.keywordCount"),
              smartTruncateLength: this.get("custom.smartTruncateLength"),
              searchItemLimit: this.get("custom.searchItemLimit"),
              maxAnnotationsPerRequest: this.get("custom.maxAnnotationsPerRequest"),
              includeWebpage: this.get("custom.includeWebpage"),
              enableCompression: this.get("custom.enableCompression")
            },
            ui: {
              includeMetadata: this.get("ui.includeMetadata")
            },
            // Current effective values
            effective: effectiveSettings
          };
        }
        /**
         * Update multiple settings at once
         */
        static updateSettings(newSettings) {
          try {
            if (newSettings.ai) {
              Object.entries(newSettings.ai).forEach(([key, value]) => {
                this.set(`ai.${key}`, value);
              });
            }
            if (newSettings.content) {
              Object.entries(newSettings.content).forEach(([key, value]) => {
                this.set(`content.${key}`, value);
              });
            }
            if (newSettings.custom) {
              Object.entries(newSettings.custom).forEach(([key, value]) => {
                this.set(`custom.${key}`, value);
              });
            }
            if (newSettings.ui) {
              Object.entries(newSettings.ui).forEach(([key, value]) => {
                this.set(`ui.${key}`, value);
              });
            }
            ztoolkit.log("[MCPSettings] Bulk settings update completed");
          } catch (error) {
            ztoolkit.log(`[MCPSettings] Error updating settings: ${error}`, "error");
            throw error;
          }
        }
        /**
         * Reset all settings to defaults
         */
        static resetToDefaults() {
          try {
            Object.entries(this.DEFAULTS).forEach(([key, value]) => {
              const prefKey = this.PREF_PREFIX + key;
              Zotero.Prefs.set(prefKey, value, true);
            });
            ztoolkit.log("[MCPSettings] All settings reset to defaults");
          } catch (error) {
            ztoolkit.log(`[MCPSettings] Error resetting settings: ${error}`, "error");
            throw error;
          }
        }
        /**
         * Check if a setting exists
         */
        static has(key) {
          try {
            const prefKey = this.PREF_PREFIX + key;
            const value = Zotero.Prefs.get(prefKey, true);
            return value !== void 0 && value !== null;
          } catch (error) {
            return false;
          }
        }
        /**
         * Delete a setting (reset to default)
         */
        static delete(key) {
          try {
            const prefKey = this.PREF_PREFIX + key;
            const value = Zotero.Prefs.get(prefKey, true);
            if (value !== void 0 && value !== null) {
              Zotero.Prefs.clear(prefKey);
              ztoolkit.log(`[MCPSettings] Cleared setting ${key}`);
            }
          } catch (error) {
            ztoolkit.log(`[MCPSettings] Error deleting setting ${key}: ${error}`, "error");
          }
        }
        /**
         * Get the current effective settings (for tools to use)
         */
        static getEffectiveSettings() {
          const contentMode = this.get("content.mode");
          if (contentMode === "custom") {
            return {
              maxTokens: this.get("ai.maxTokens"),
              maxContentLength: this.get("custom.maxContentLength"),
              maxAttachments: this.get("custom.maxAttachments"),
              maxNotes: this.get("custom.maxNotes"),
              keywordCount: this.get("custom.keywordCount"),
              smartTruncateLength: this.get("custom.smartTruncateLength"),
              searchItemLimit: this.get("custom.searchItemLimit"),
              maxAnnotationsPerRequest: this.get("custom.maxAnnotationsPerRequest"),
              includeWebpage: this.get("custom.includeWebpage"),
              enableCompression: this.get("custom.enableCompression"),
              preserveFormatting: this.get("text.preserveFormatting"),
              preserveHeadings: this.get("text.preserveHeadings"),
              preserveLists: this.get("text.preserveLists"),
              preserveEmphasis: this.get("text.preserveEmphasis")
            };
          } else {
            const mode = this.UNIFIED_MODES[contentMode] || this.UNIFIED_MODES.standard;
            return {
              maxTokens: this.get("ai.maxTokens"),
              maxContentLength: mode.maxContentLength,
              maxAttachments: mode.maxAttachments,
              maxNotes: mode.maxNotes,
              keywordCount: mode.keywordCount,
              smartTruncateLength: mode.smartTruncateLength,
              searchItemLimit: mode.searchItemLimit,
              maxAnnotationsPerRequest: mode.maxAnnotationsPerRequest,
              includeWebpage: mode.includeWebpage,
              enableCompression: mode.enableCompression,
              preserveFormatting: this.get("text.preserveFormatting"),
              preserveHeadings: this.get("text.preserveHeadings"),
              preserveLists: this.get("text.preserveLists"),
              preserveEmphasis: this.get("text.preserveEmphasis")
            };
          }
        }
        /**
         * Apply a content mode configuration
         */
        static applyMode(modeName) {
          try {
            if (modeName === "custom") {
              this.set("content.mode", "custom");
              ztoolkit.log(`[MCPSettings] Switched to custom mode`);
              return;
            }
            const mode = this.UNIFIED_MODES[modeName];
            if (!mode) {
              throw new Error(`Unknown mode: ${modeName}`);
            }
            this.set("content.mode", modeName);
            ztoolkit.log(`[MCPSettings] Applied ${modeName} mode`);
          } catch (error) {
            ztoolkit.log(`[MCPSettings] Error applying mode ${modeName}: ${error}`, "error");
            throw error;
          }
        }
        /**
         * Get available content modes info
         */
        static getModesInfo() {
          return {
            current: this.get("content.mode"),
            available: {
              minimal: {
                ...this.UNIFIED_MODES.minimal
              },
              preview: {
                ...this.UNIFIED_MODES.preview
              },
              standard: {
                ...this.UNIFIED_MODES.standard
              },
              complete: {
                ...this.UNIFIED_MODES.complete
              },
              custom: {
                name: "\u81EA\u5B9A\u4E49\u6A21\u5F0F / Custom",
                description: "\u624B\u52A8\u914D\u7F6E\u6240\u6709\u53C2\u6570 / Manually configure all parameters",
                maxContentLength: this.get("custom.maxContentLength"),
                maxAttachments: this.get("custom.maxAttachments"),
                maxNotes: this.get("custom.maxNotes"),
                keywordCount: this.get("custom.keywordCount"),
                smartTruncateLength: this.get("custom.smartTruncateLength"),
                searchItemLimit: this.get("custom.searchItemLimit"),
                maxAnnotationsPerRequest: this.get("custom.maxAnnotationsPerRequest"),
                includeWebpage: this.get("custom.includeWebpage"),
                enableCompression: this.get("custom.enableCompression")
              }
            }
          };
        }
        /**
         * Validate a setting value
         */
        static validateSetting(key, value) {
          switch (key) {
            case "ai.maxTokens":
              if (typeof value !== "number" || value < 1e3 || value > 1e5) {
                return { valid: false, error: "maxTokens must be a number between 1000 and 100000" };
              }
              break;
            case "content.mode":
              if (!["minimal", "preview", "standard", "complete", "custom"].includes(value)) {
                return { valid: false, error: "content mode must be one of: minimal, preview, standard, complete, custom" };
              }
              break;
            case "custom.maxContentLength":
              if (typeof value !== "number" || value < 100 || value > 5e4) {
                return { valid: false, error: "maxContentLength must be a number between 100 and 50000" };
              }
              break;
            case "custom.maxAttachments":
              if (typeof value !== "number" || value < 1 || value > 50) {
                return { valid: false, error: "maxAttachments must be a number between 1 and 50" };
              }
              break;
            case "custom.maxNotes":
              if (typeof value !== "number" || value < 1 || value > 100) {
                return { valid: false, error: "maxNotes must be a number between 1 and 100" };
              }
              break;
            case "custom.smartTruncateLength":
              if (typeof value !== "number" || value < 50 || value > 1e3) {
                return { valid: false, error: "smartTruncateLength must be a number between 50 and 1000" };
              }
              break;
            case "custom.keywordCount":
              if (typeof value !== "number" || value < 1 || value > 20) {
                return { valid: false, error: "keywordCount must be a number between 1 and 20" };
              }
              break;
            case "custom.searchItemLimit":
              if (typeof value !== "number" || value < 10 || value > 1e3) {
                return { valid: false, error: "searchItemLimit must be a number between 10 and 1000" };
              }
              break;
            case "custom.maxAnnotationsPerRequest":
              if (typeof value !== "number" || value < 10 || value > 200) {
                return { valid: false, error: "maxAnnotationsPerRequest must be a number between 10 and 200" };
              }
              break;
            case "custom.includeWebpage":
            case "custom.enableCompression":
            case "ui.includeMetadata":
              if (typeof value !== "boolean") {
                return { valid: false, error: "Value must be a boolean" };
              }
              break;
            default:
              if (value === null || value === void 0) {
                return { valid: false, error: "Value cannot be null or undefined" };
              }
              break;
          }
          return { valid: true };
        }
        /**
         * Export settings to JSON (for backup/sharing)
         */
        static exportSettings() {
          const settings = this.getAllSettings();
          return JSON.stringify(settings, null, 2);
        }
        /**
         * Import settings from JSON
         */
        static importSettings(jsonSettings) {
          try {
            const settings = JSON.parse(jsonSettings);
            this.updateSettings(settings);
            ztoolkit.log("[MCPSettings] Settings imported successfully");
          } catch (error) {
            ztoolkit.log(`[MCPSettings] Error importing settings: ${error}`, "error");
            throw new Error("Invalid settings JSON format");
          }
        }
        /**
         * Get setting info for UI display
         */
        static getSettingInfo() {
          const effectiveSettings = this.getEffectiveSettings();
          return {
            ai: {
              maxTokens: {
                current: this.get("ai.maxTokens"),
                default: this.DEFAULTS["ai.maxTokens"],
                range: "1000-100000",
                description: "Maximum tokens for AI processing"
              }
            },
            content: {
              mode: {
                current: this.get("content.mode"),
                default: this.DEFAULTS["content.mode"],
                options: ["minimal", "preview", "standard", "complete", "custom"],
                description: "Unified content processing mode"
              }
            },
            effective: {
              maxContentLength: {
                current: effectiveSettings.maxContentLength,
                description: "Current effective content length limit"
              },
              maxAttachments: {
                current: effectiveSettings.maxAttachments,
                description: "Current effective max attachments"
              },
              maxNotes: {
                current: effectiveSettings.maxNotes,
                description: "Current effective max notes"
              },
              keywordCount: {
                current: effectiveSettings.keywordCount,
                description: "Current effective keyword count"
              },
              smartTruncateLength: {
                current: effectiveSettings.smartTruncateLength,
                description: "Current effective truncate length"
              },
              searchItemLimit: {
                current: effectiveSettings.searchItemLimit,
                description: "Current effective search limit"
              },
              maxAnnotationsPerRequest: {
                current: effectiveSettings.maxAnnotationsPerRequest,
                description: "Current effective max annotations"
              },
              includeWebpage: {
                current: effectiveSettings.includeWebpage,
                description: "Current effective webpage inclusion"
              },
              enableCompression: {
                current: effectiveSettings.enableCompression,
                description: "Current effective compression setting"
              }
            }
          };
        }
      };
    }
  });

  // src/modules/intelligentContentProcessor.ts
  var IntelligentContentProcessor, intelligentContentProcessor;
  var init_intelligentContentProcessor = __esm({
    "src/modules/intelligentContentProcessor.ts"() {
      "use strict";
      IntelligentContentProcessor = class {
        /**
         * Process text content with intelligent algorithms
         */
        async processContent(text, mode, contentControl = {}) {
          try {
            ztoolkit.log(`[IntelligentProcessor] Processing content with mode: ${mode}`);
            if (!text || text.trim().length === 0) {
              return this.createEmptyResult();
            }
            const sentences = this.splitIntoSentences(text);
            const scoredSentences = await this.calculateImportanceScores(sentences, text);
            const selectedSentences = this.selectContentByMode(scoredSentences, mode, contentControl);
            const processedText = this.reconstructText(selectedSentences, contentControl);
            const metadata = this.generateMetadata(text, processedText, sentences, selectedSentences, mode, contentControl);
            return {
              originalText: text,
              processedText,
              sentences: selectedSentences,
              metadata
            };
          } catch (error) {
            ztoolkit.log(`[IntelligentProcessor] Error processing content: ${error}`, "error");
            return this.fallbackProcessing(text, mode);
          }
        }
        /**
         * Split text into sentences with position tracking
         */
        splitIntoSentences(text) {
          const sentenceRegex = /[.!?]+\s+|[。！？]+\s*|\n\s*\n/g;
          const sentences = [];
          let lastIndex = 0;
          let match;
          while ((match = sentenceRegex.exec(text)) !== null) {
            const sentence = text.substring(lastIndex, match.index + match[0].length).trim();
            if (sentence.length > 10) {
              sentences.push(sentence);
            }
            lastIndex = match.index + match[0].length;
          }
          const remaining = text.substring(lastIndex).trim();
          if (remaining.length > 10) {
            sentences.push(remaining);
          }
          return sentences.map((sentence, index) => ({
            content: sentence,
            position: index / Math.max(sentences.length - 1, 1),
            // 0 to 1
            importance: 0,
            // Will be calculated
            tfIdfScore: 0,
            textRankScore: 0,
            positionWeight: 0,
            length: sentence.length,
            keywords: [],
            isComplete: this.isCompleteSentence(sentence)
          }));
        }
        /**
         * Calculate comprehensive importance scores using multiple algorithms
         */
        async calculateImportanceScores(sentences, fullText) {
          ztoolkit.log(`[IntelligentProcessor] Calculating importance scores for ${sentences.length} sentences`);
          const tfIdfScores = this.calculateTfIdf(sentences, fullText);
          const textRankScores = this.calculateTextRank(sentences);
          const positionWeights = this.calculatePositionWeights(sentences);
          return sentences.map((sentence, index) => {
            const tfIdf = tfIdfScores[index] || 0;
            const textRank = textRankScores[index] || 0;
            const posWeight = positionWeights[index] || 0;
            const contentType = this.classifyContentSection(sentence.content, sentence.position);
            let contentTypeModifier = 1;
            switch (contentType) {
              case "reference":
                contentTypeModifier = 0.1;
                break;
              case "supplementary":
                contentTypeModifier = 0.3;
                break;
              case "main_content":
                contentTypeModifier = 1;
                break;
            }
            const baseImportance = 0.4 * tfIdf + 0.35 * textRank + 0.25 * posWeight;
            const adjustedImportance = baseImportance * contentTypeModifier;
            return {
              ...sentence,
              tfIdfScore: tfIdf,
              textRankScore: textRank,
              positionWeight: posWeight,
              importance: Math.min(1, adjustedImportance),
              // Normalize to 0-1
              keywords: this.extractKeywords(sentence.content, 3),
              contentType
              // Add content type for debugging
            };
          });
        }
        /**
         * TF-IDF calculation implementation
         */
        calculateTfIdf(sentences, fullText) {
          const allWords = this.tokenize(fullText.toLowerCase());
          const wordCount = allWords.length;
          const uniqueWords = [...new Set(allWords)];
          const documentFreq = /* @__PURE__ */ new Map();
          uniqueWords.forEach((word) => {
            let count = 0;
            sentences.forEach((sentence) => {
              if (sentence.content.toLowerCase().includes(word)) {
                count++;
              }
            });
            documentFreq.set(word, count);
          });
          return sentences.map((sentence) => {
            const sentenceWords = this.tokenize(sentence.content.toLowerCase());
            const sentenceWordCount = sentenceWords.length;
            if (sentenceWordCount === 0) return 0;
            let totalTfIdf = 0;
            const wordFreq = /* @__PURE__ */ new Map();
            sentenceWords.forEach((word) => {
              wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
            });
            [...wordFreq.keys()].forEach((word) => {
              const tf = wordFreq.get(word) / sentenceWordCount;
              const df = documentFreq.get(word) || 1;
              const idf = Math.log(sentences.length / df);
              totalTfIdf += tf * idf;
            });
            return totalTfIdf / wordFreq.size;
          });
        }
        /**
         * TextRank calculation implementation (simplified graph-based approach)
         */
        calculateTextRank(sentences) {
          const numSentences = sentences.length;
          if (numSentences <= 1) return [1];
          const similarityMatrix = this.createSimilarityMatrix(sentences);
          let ranks = new Array(numSentences).fill(1 / numSentences);
          const dampingFactor = 0.85;
          const iterations = 10;
          for (let iter = 0; iter < iterations; iter++) {
            const newRanks = new Array(numSentences).fill(0);
            for (let i = 0; i < numSentences; i++) {
              let sum = 0;
              for (let j = 0; j < numSentences; j++) {
                if (i !== j && similarityMatrix[j][i] > 0) {
                  const outboundSum = similarityMatrix[j].reduce((acc, val, idx) => idx !== j ? acc + val : acc, 0);
                  if (outboundSum > 0) {
                    sum += similarityMatrix[j][i] / outboundSum * ranks[j];
                  }
                }
              }
              newRanks[i] = 1 - dampingFactor + dampingFactor * sum;
            }
            ranks = newRanks;
          }
          const maxRank = Math.max(...ranks);
          const minRank = Math.min(...ranks);
          const range = maxRank - minRank;
          return range > 0 ? ranks.map((rank) => (rank - minRank) / range) : ranks;
        }
        /**
         * Create similarity matrix for TextRank
         */
        createSimilarityMatrix(sentences) {
          const numSentences = sentences.length;
          const matrix = Array(numSentences).fill(null).map(() => Array(numSentences).fill(0));
          for (let i = 0; i < numSentences; i++) {
            for (let j = 0; j < numSentences; j++) {
              if (i !== j) {
                matrix[i][j] = this.calculateSentenceSimilarity(sentences[i], sentences[j]);
              }
            }
          }
          return matrix;
        }
        /**
         * Calculate similarity between two sentences using word overlap
         */
        calculateSentenceSimilarity(sent1, sent2) {
          const words1 = new Set(this.tokenize(sent1.content.toLowerCase()));
          const words2 = new Set(this.tokenize(sent2.content.toLowerCase()));
          const intersection = new Set([...words1].filter((word) => words2.has(word)));
          const union = /* @__PURE__ */ new Set([...words1, ...words2]);
          return union.size > 0 ? intersection.size / union.size : 0;
        }
        /**
         * Calculate position weights (beginning and end more important)
         */
        calculatePositionWeights(sentences) {
          return sentences.map((sentence) => {
            const pos = sentence.position;
            if (pos <= 0.1) return 1;
            if (pos >= 0.9) return 0.9;
            if (pos <= 0.3) return 0.7;
            if (pos >= 0.7) return 0.6;
            return 0.3;
          });
        }
        /**
         * Select content based on mode and content control parameters
         */
        selectContentByMode(sentences, mode, contentControl) {
          const limits = this.resolveContentLimits(mode, contentControl);
          ztoolkit.log(`[IntelligentProcessor] Mode: ${mode}, Limits: ${JSON.stringify(limits)}`);
          if (mode === "minimal") {
            return this.selectMinimalContent(sentences, limits, contentControl);
          }
          const sortedSentences = [...sentences].sort((a, b) => b.importance - a.importance);
          let selectedSentences = [];
          let currentLength = 0;
          for (const sentence of sortedSentences) {
            const wouldExceedLimit = limits.maxContentLength > 0 && currentLength + sentence.length > limits.maxContentLength;
            if (wouldExceedLimit) {
              if (contentControl.expandIfImportant && sentence.importance > 0.8) {
                ztoolkit.log(`[IntelligentProcessor] Expanding for high importance content: ${sentence.importance}`);
                const maxExpanded = limits.maxContentLength * (contentControl.smartExpansion?.maxExpansionRatio || 1.5);
                if (currentLength + sentence.length <= maxExpanded) {
                  selectedSentences.push(sentence);
                  currentLength += sentence.length;
                }
              } else if (contentControl.prioritizeCompleteness && sentence.importance > 0.5) {
                selectedSentences.push(sentence);
                currentLength += sentence.length;
              } else {
                break;
              }
            } else {
              selectedSentences.push(sentence);
              currentLength += sentence.length;
            }
          }
          return selectedSentences.sort((a, b) => a.position - b.position);
        }
        /**
         * Special selection logic for minimal mode to prioritize main content
         */
        selectMinimalContent(sentences, limits, contentControl) {
          const mainContent = sentences.filter((s) => s.contentType === "main_content");
          const otherContent = sentences.filter((s) => s.contentType !== "main_content");
          ztoolkit.log(`[IntelligentProcessor] Minimal mode: ${mainContent.length} main, ${otherContent.length} other sentences`);
          const sortedMainContent = [...mainContent].sort((a, b) => b.importance - a.importance);
          let selectedSentences = [];
          let currentLength = 0;
          for (const sentence of sortedMainContent) {
            if (limits.maxContentLength > 0 && currentLength + sentence.length > limits.maxContentLength) {
              break;
            }
            selectedSentences.push(sentence);
            currentLength += sentence.length;
          }
          if (selectedSentences.length === 0 && otherContent.length > 0) {
            const sortedOtherContent = [...otherContent].sort((a, b) => b.importance - a.importance);
            for (const sentence of sortedOtherContent) {
              if (limits.maxContentLength > 0 && currentLength + sentence.length > limits.maxContentLength) {
                break;
              }
              selectedSentences.push(sentence);
              currentLength += sentence.length;
              if (selectedSentences.length >= 2) {
                break;
              }
            }
          }
          return selectedSentences.sort((a, b) => a.position - b.position);
        }
        /**
         * Resolve effective content limits considering mode and overrides
         */
        resolveContentLimits(mode, contentControl) {
          const baseLimits = this.getModeConfiguration(mode);
          return {
            maxContentLength: contentControl.maxContentLength ?? (contentControl.allowExtended ? baseLimits.maxContentLength * 1.5 : baseLimits.maxContentLength),
            maxAttachments: contentControl.maxAttachments ?? baseLimits.maxAttachments,
            maxNotes: contentControl.maxNotes ?? baseLimits.maxNotes
          };
        }
        /**
         * Get base mode configuration
         */
        getModeConfiguration(mode) {
          const configs = {
            "minimal": { maxContentLength: 500, maxAttachments: 2, maxNotes: 3 },
            "preview": { maxContentLength: 1500, maxAttachments: 5, maxNotes: 8 },
            "smart": { maxContentLength: 3e3, maxAttachments: 10, maxNotes: 15 },
            "full": { maxContentLength: -1, maxAttachments: -1, maxNotes: -1 }
          };
          return configs[mode] || configs["smart"];
        }
        /**
         * Reconstruct text from selected sentences
         */
        reconstructText(sentences, contentControl) {
          if (sentences.length === 0) return "";
          let result = sentences.map((s) => s.content).join(" ");
          if (contentControl.requireContext !== false && !this.isCompleteSentence(result)) {
            result += "...";
          }
          return result.trim();
        }
        /**
         * Generate comprehensive metadata
         */
        generateMetadata(originalText, processedText, allSentences, selectedSentences, mode, contentControl) {
          const avgImportance = selectedSentences.length > 0 ? selectedSentences.reduce((sum, s) => sum + s.importance, 0) / selectedSentences.length : 0;
          return {
            originalLength: originalText.length,
            processedLength: processedText.length,
            preservationRatio: originalText.length > 0 ? processedText.length / originalText.length : 1,
            selectedSentences: selectedSentences.length,
            totalSentences: allSentences.length,
            averageImportance: avgImportance,
            processingMethod: "intelligent-scoring",
            appliedLimits: this.resolveContentLimits(mode, contentControl),
            expansionTriggered: contentControl.expandIfImportant && selectedSentences.some((s) => s.importance > 0.8)
          };
        }
        /**
         * Utility methods
         */
        tokenize(text) {
          return text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((word) => word.length > 2);
        }
        extractKeywords(text, count) {
          const words = this.tokenize(text);
          const wordFreq = /* @__PURE__ */ new Map();
          words.forEach((word) => {
            wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
          });
          return [...wordFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, count).map(([word]) => word);
        }
        isCompleteSentence(text) {
          return /[.!?。！？]$/.test(text.trim());
        }
        /**
         * Detect if sentence is likely a reference or citation
         */
        isReference(sentence) {
          const content = sentence.trim();
          const lowerContent = content.toLowerCase();
          if (/^(references?|bibliography|works?\s+cited|literature\s+cited)\s*$/i.test(content)) {
            return true;
          }
          const referencePatterns = [
            /^\d+\.\s+[A-Z][a-z]+,?\s+[A-Z][\.\w]*/,
            // "1. Smith, J." or "1. Smith, John"
            /^\[\d+\]\s*/,
            // "[1]" style citations
            /^[A-Z][a-z]+,\s*[A-Z][\.\w]*.*\(\d{4}[a-z]?\)/,
            // "Smith, J. (2020)" 
            /^[A-Z][a-z]+,\s*[A-Z][\.\w]*,?\s+.*\d{4}[a-z]?[\.,]/,
            // "Smith, J., Title, 2020."
            /et\s+al\..*\(\d{4}\)/,
            // "Smith et al. (2020)"
            /doi\s*:\s*10\.\d+/,
            // DOI patterns
            /https?:\/\/[^\s]+/,
            // URLs
            /www\.[^\s]+/
            // www URLs
          ];
          const hasReferencePattern = referencePatterns.some((pattern) => pattern.test(content));
          const academicTerms = [
            "journal",
            "proceedings",
            "conference",
            "symposium",
            "vol\\.",
            "volume",
            "issue",
            "pp\\.",
            "pages",
            "editor",
            "eds\\.",
            "publisher",
            "press",
            "retrieved from",
            "available at"
          ];
          const hasAcademicTerms = academicTerms.some(
            (term) => new RegExp(term, "i").test(lowerContent)
          );
          const hasYear = /\(\d{4}[a-z]?\)|\b\d{4}[a-z]?[\.,]/.test(content);
          const hasAuthorPattern = /^[A-Z][a-z]+,\s*[A-Z]/.test(content);
          const startsWithNumber = /^\d+\./.test(content);
          const hasMultipleAuthors = /,\s*[A-Z]\./g.test(content) || /&|and\s+[A-Z][a-z]+,/.test(content);
          let indicators = 0;
          if (hasReferencePattern) indicators += 3;
          if (hasAcademicTerms && hasYear) indicators += 2;
          if (hasAuthorPattern && hasYear) indicators += 2;
          if (startsWithNumber && hasAuthorPattern) indicators += 2;
          if (hasMultipleAuthors) indicators += 1;
          if (hasYear) indicators += 1;
          return indicators >= 2;
        }
        /**
         * Detect content sections and classify importance
         */
        classifyContentSection(sentence, position) {
          if (this.isReference(sentence)) {
            return "reference";
          }
          const supplementaryPatterns = [
            /acknowledgment|acknowledgement|thanks|funding|grant|support/i,
            /appendix|supplementary|additional|extra/i,
            /conflict\s+of\s+interest|competing\s+interest/i
          ];
          if (supplementaryPatterns.some((pattern) => pattern.test(sentence))) {
            return "supplementary";
          }
          return "main_content";
        }
        createEmptyResult() {
          return {
            originalText: "",
            processedText: "",
            sentences: [],
            metadata: {
              originalLength: 0,
              processedLength: 0,
              preservationRatio: 1,
              selectedSentences: 0,
              totalSentences: 0,
              averageImportance: 0,
              processingMethod: "empty",
              appliedLimits: {},
              expansionTriggered: false
            }
          };
        }
        fallbackProcessing(text, mode) {
          const config2 = this.getModeConfiguration(mode);
          const truncatedText = config2.maxContentLength > 0 && text.length > config2.maxContentLength ? text.substring(0, config2.maxContentLength) + "..." : text;
          return {
            originalText: text,
            processedText: truncatedText,
            sentences: [],
            metadata: {
              originalLength: text.length,
              processedLength: truncatedText.length,
              preservationRatio: truncatedText.length / text.length,
              selectedSentences: 0,
              totalSentences: 0,
              averageImportance: 0,
              processingMethod: "fallback-truncation",
              appliedLimits: config2,
              expansionTriggered: false
            }
          };
        }
      };
      intelligentContentProcessor = new IntelligentContentProcessor();
    }
  });

  // src/modules/unifiedContentExtractor.ts
  var UnifiedContentExtractor;
  var init_unifiedContentExtractor = __esm({
    "src/modules/unifiedContentExtractor.ts"() {
      "use strict";
      init_pdfProcessor();
      init_mcpSettingsService();
      init_intelligentContentProcessor();
      init_textFormatter();
      UnifiedContentExtractor = class {
        intelligentProcessor = new IntelligentContentProcessor();
        /**
         * Extract content from an item with mode control and intelligent processing
         */
        async getItemContent(itemKey, include = {}, mode, contentControl) {
          try {
            const item = Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, itemKey);
            if (!item) {
              throw new Error(`Item with key ${itemKey} not found`);
            }
            ztoolkit.log(`[UnifiedContentExtractor] Getting content for item ${itemKey}`);
            const effectiveMode = mode || MCPSettingsService.get("content.mode");
            const modeConfig = this.getModeConfiguration(effectiveMode);
            ztoolkit.log(`[UnifiedContentExtractor] Using output mode: ${effectiveMode}`);
            const options = {
              pdf: true,
              attachments: true,
              notes: true,
              abstract: true,
              webpage: modeConfig.includeWebpage,
              ...include
            };
            const result = {
              itemKey,
              title: item.getDisplayTitle(),
              content: {},
              metadata: {
                extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
                sources: [],
                totalLength: 0,
                mode: effectiveMode,
                appliedLimits: {
                  maxContentLength: modeConfig.maxContentLength,
                  maxAttachments: modeConfig.maxAttachments,
                  maxNotes: modeConfig.maxNotes,
                  truncated: false
                }
              }
            };
            if (options.abstract) {
              const abstract = this.extractAbstract(item);
              if (abstract) {
                result.content.abstract = {
                  content: abstract,
                  length: abstract.length,
                  type: "abstract"
                };
                result.metadata.sources.push("abstract");
                result.metadata.totalLength += abstract.length;
              }
            }
            if (options.pdf || options.attachments) {
              const attachments = await this.extractAttachments(item, options, modeConfig, effectiveMode, contentControl);
              if (attachments.length > 0) {
                result.content.attachments = attachments;
                result.metadata.sources.push("attachments");
                result.metadata.totalLength += attachments.reduce((sum, att) => sum + att.length, 0);
              }
            }
            if (options.notes) {
              const notes = await this.extractNotes(item, modeConfig, effectiveMode, contentControl);
              if (notes.length > 0) {
                result.content.notes = notes;
                result.metadata.sources.push("notes");
                result.metadata.totalLength += notes.reduce((sum, note) => sum + note.length, 0);
              }
            }
            if (options.webpage) {
              const webpage = await this.extractWebpageContent(item);
              if (webpage) {
                result.content.webpage = webpage;
                result.metadata.sources.push("webpage");
                result.metadata.totalLength += webpage.length;
              }
            }
            ztoolkit.log(`[UnifiedContentExtractor] Extracted ${result.metadata.totalLength} characters from ${result.metadata.sources.length} sources`);
            return result;
          } catch (error) {
            ztoolkit.log(`[UnifiedContentExtractor] Error in getItemContent: ${error}`, "error");
            throw error;
          }
        }
        /**
         * Extract content from a specific attachment with mode control (replaces get_attachment_content)
         */
        async getAttachmentContent(attachmentKey, mode, contentControl) {
          try {
            const attachment = Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, attachmentKey);
            if (!attachment?.isAttachment()) {
              throw new Error(`Attachment with key ${attachmentKey} not found`);
            }
            ztoolkit.log(`[UnifiedContentExtractor] Processing attachment: ${attachmentKey}`);
            const effectiveMode = mode || MCPSettingsService.get("content.mode");
            const modeConfig = this.getModeConfiguration(effectiveMode);
            return await this.processAttachment(attachment, modeConfig, effectiveMode, contentControl);
          } catch (error) {
            ztoolkit.log(`[UnifiedContentExtractor] Error in getAttachmentContent: ${error}`, "error");
            throw error;
          }
        }
        /**
         * Extract abstract from item
         */
        extractAbstract(item) {
          try {
            const abstract = item.getField("abstractNote");
            return abstract && abstract.trim().length > 0 ? abstract.trim() : null;
          } catch (error) {
            return null;
          }
        }
        /**
         * Extract content from all attachments with intelligent processing
         */
        async extractAttachments(item, options, modeConfig, mode, contentControl) {
          const attachments = [];
          const attachmentIDs = item.getAttachments();
          const limitedAttachmentIDs = modeConfig.maxAttachments > 0 ? attachmentIDs.slice(0, modeConfig.maxAttachments) : attachmentIDs;
          for (const attachmentID of limitedAttachmentIDs) {
            try {
              const attachment = Zotero.Items.get(attachmentID);
              const contentType = attachment.attachmentContentType;
              const isPDF = this.isPDF(attachment, contentType);
              if (isPDF && !options.pdf) continue;
              if (!isPDF && !options.attachments) continue;
              const attachmentContent = await this.processAttachment(attachment, modeConfig, mode, contentControl);
              if (attachmentContent && attachmentContent.content) {
                attachments.push(attachmentContent);
              }
            } catch (error) {
              ztoolkit.log(`[UnifiedContentExtractor] Error extracting attachment ${attachmentID}: ${error}`, "warn");
            }
          }
          return attachments;
        }
        /**
         * Extract notes content with intelligent processing
         */
        async extractNotes(item, modeConfig, mode, contentControl) {
          const notes = [];
          const noteIDs = item.getNotes();
          const limitedNoteIDs = modeConfig.maxNotes > 0 ? noteIDs.slice(0, modeConfig.maxNotes) : noteIDs;
          for (const noteID of limitedNoteIDs) {
            try {
              const note = Zotero.Items.get(noteID);
              const noteContent = await this.extractNoteContent(note, modeConfig, mode, contentControl);
              if (noteContent) {
                notes.push(noteContent);
              }
            } catch (error) {
              ztoolkit.log(`[UnifiedContentExtractor] Error extracting note ${noteID}: ${error}`, "warn");
            }
          }
          return notes;
        }
        /**
         * Extract single note content with intelligent processing
         */
        async extractNoteContent(note, modeConfig, mode, contentControl) {
          try {
            if (!note || !note.isNote()) {
              return null;
            }
            const noteText = note.getNote();
            if (!noteText || noteText.trim().length === 0) {
              return null;
            }
            const settings = MCPSettingsService.getEffectiveSettings();
            let plainText = TextFormatter.htmlToText(noteText, {
              preserveParagraphs: settings.preserveFormatting,
              preserveHeadings: settings.preserveHeadings,
              preserveLists: settings.preserveLists,
              preserveEmphasis: settings.preserveEmphasis
            });
            let processedResult = null;
            let finalContent = plainText;
            if (plainText.length > 200 && mode !== "complete") {
              try {
                processedResult = await this.intelligentProcessor.processContent(plainText, mode, contentControl);
                finalContent = processedResult.processedText;
              } catch (error) {
                ztoolkit.log(`[UnifiedContentExtractor] Intelligent processing failed for note, falling back: ${error}`, "warn");
                if (modeConfig.maxContentLength > 0 && plainText.length > modeConfig.maxContentLength) {
                  finalContent = this.smartTruncate(plainText, modeConfig.maxContentLength);
                }
              }
            } else if (modeConfig.maxContentLength > 0 && plainText.length > modeConfig.maxContentLength) {
              finalContent = this.smartTruncate(plainText, modeConfig.maxContentLength);
            }
            const result = {
              noteKey: note.key,
              title: note.getNoteTitle() || "Untitled Note",
              content: finalContent,
              htmlContent: noteText,
              length: finalContent.length,
              originalLength: plainText.length,
              truncated: finalContent.length < plainText.length,
              dateModified: note.dateModified,
              type: "note"
            };
            if (processedResult) {
              result.intelligentProcessing = {
                enabled: true,
                processingMethod: processedResult.metadata.processingMethod,
                preservationRatio: processedResult.metadata.preservationRatio,
                averageImportance: processedResult.metadata.averageImportance,
                selectedSentences: processedResult.metadata.selectedSentences,
                totalSentences: processedResult.metadata.totalSentences
              };
            }
            return result;
          } catch (error) {
            ztoolkit.log(`[UnifiedContentExtractor] Error extracting note content: ${error}`, "error");
            return null;
          }
        }
        /**
         * Extract webpage content from snapshots
         */
        async extractWebpageContent(item) {
          try {
            const url = item.getField("url");
            if (!url) {
              return null;
            }
            const attachmentIDs = item.getAttachments();
            for (const attachmentID of attachmentIDs) {
              const attachment = Zotero.Items.get(attachmentID);
              if (attachment.attachmentContentType && attachment.attachmentContentType.includes("html")) {
                const content = await this.extractHTMLText(attachment.getFilePath());
                if (content && content.length > 0) {
                  return {
                    url,
                    filename: attachment.attachmentFilename,
                    filePath: attachment.getFilePath(),
                    content: content.trim(),
                    length: content.length,
                    type: "webpage_snapshot",
                    extractedAt: (/* @__PURE__ */ new Date()).toISOString()
                  };
                }
              }
            }
            return null;
          } catch (error) {
            ztoolkit.log(`[UnifiedContentExtractor] Error extracting webpage content: ${error}`, "error");
            return null;
          }
        }
        /**
         * Process a single attachment with intelligent processing (unified logic)
         */
        async processAttachment(attachment, modeConfig, mode, contentControl) {
          const filePath = attachment.getFilePath();
          const contentType = attachment.attachmentContentType;
          const filename = attachment.attachmentFilename;
          if (!filePath) {
            ztoolkit.log(`[UnifiedContentExtractor] No file path for attachment ${attachment.key}`, "warn");
            return null;
          }
          ztoolkit.log(`[UnifiedContentExtractor] Processing attachment: ${filename} (${contentType})`);
          let content = "";
          let extractionMethod = "unknown";
          try {
            if (this.isPDF(attachment, contentType)) {
              content = await this.extractPDFText(filePath);
              extractionMethod = "pdf_processor";
            } else if (this.isHTML(contentType)) {
              content = await this.extractHTMLText(filePath);
              extractionMethod = "html_parsing";
            } else if (this.isText(contentType)) {
              content = await this.extractPlainText(filePath);
              extractionMethod = "text_reading";
            }
            if (!content || content.trim().length === 0) {
              return null;
            }
            let processedResult = null;
            let finalContent = content.trim();
            const originalLength = finalContent.length;
            if (finalContent.length > 500 && mode !== "complete") {
              try {
                processedResult = await this.intelligentProcessor.processContent(finalContent, mode, contentControl);
                finalContent = processedResult.processedText;
              } catch (error) {
                ztoolkit.log(`[UnifiedContentExtractor] Intelligent processing failed for attachment, falling back: ${error}`, "warn");
                if (modeConfig.maxContentLength > 0 && finalContent.length > modeConfig.maxContentLength) {
                  finalContent = this.smartTruncate(finalContent, modeConfig.maxContentLength);
                }
              }
            } else if (modeConfig.maxContentLength > 0 && finalContent.length > modeConfig.maxContentLength) {
              finalContent = this.smartTruncate(finalContent, modeConfig.maxContentLength);
            }
            const result = {
              attachmentKey: attachment.key,
              filename,
              filePath,
              contentType,
              type: this.categorizeAttachmentType(contentType),
              content: finalContent,
              length: finalContent.length,
              originalLength,
              truncated: finalContent.length < originalLength,
              extractionMethod,
              extractedAt: (/* @__PURE__ */ new Date()).toISOString()
            };
            if (processedResult) {
              result.intelligentProcessing = {
                enabled: true,
                processingMethod: processedResult.metadata.processingMethod,
                preservationRatio: processedResult.metadata.preservationRatio,
                averageImportance: processedResult.metadata.averageImportance,
                selectedSentences: processedResult.metadata.selectedSentences,
                totalSentences: processedResult.metadata.totalSentences
              };
            }
            return result;
          } catch (error) {
            ztoolkit.log(`[UnifiedContentExtractor] Error processing attachment ${attachment.key}: ${error}`, "error");
            return null;
          }
        }
        /**
         * Extract text from PDF using PDFProcessor with formatting
         */
        async extractPDFText(filePath) {
          const processor = new PDFProcessor(ztoolkit);
          try {
            const rawText = await processor.extractText(filePath);
            return TextFormatter.formatPDFText(rawText);
          } finally {
            processor.terminate();
          }
        }
        /**
         * Extract text from HTML files
         */
        async extractHTMLText(filePath) {
          try {
            if (!filePath) return "";
            const htmlContent = await Zotero.File.getContentsAsync(filePath);
            const settings = MCPSettingsService.getEffectiveSettings();
            return TextFormatter.htmlToText(htmlContent, {
              preserveParagraphs: settings.preserveFormatting,
              preserveHeadings: settings.preserveHeadings,
              preserveLists: settings.preserveLists,
              preserveEmphasis: settings.preserveEmphasis
            });
          } catch (error) {
            ztoolkit.log(`[UnifiedContentExtractor] Error reading HTML file ${filePath}: ${error}`, "error");
            return "";
          }
        }
        /**
         * Extract text from plain text files
         */
        async extractPlainText(filePath) {
          try {
            if (!filePath) return "";
            return await Zotero.File.getContentsAsync(filePath);
          } catch (error) {
            ztoolkit.log(`[UnifiedContentExtractor] Error reading text file ${filePath}: ${error}`, "error");
            return "";
          }
        }
        /**
         * Check if attachment is a PDF
         */
        isPDF(attachment, contentType) {
          if (contentType && contentType.includes("pdf")) {
            return true;
          }
          const filename = attachment.attachmentFilename || "";
          if (filename.toLowerCase().endsWith(".pdf")) {
            return true;
          }
          const path = attachment.getFilePath() || "";
          if (path.toLowerCase().endsWith(".pdf")) {
            return true;
          }
          return false;
        }
        /**
         * Check if attachment is HTML
         */
        isHTML(contentType) {
          return !!(contentType && (contentType.includes("html") || contentType.includes("xml")));
        }
        /**
         * Check if attachment is plain text
         */
        isText(contentType) {
          return !!(contentType && contentType.includes("text") && !contentType.includes("html"));
        }
        /**
         * Categorize attachment type
         */
        categorizeAttachmentType(contentType) {
          if (!contentType) return "unknown";
          if (contentType.includes("pdf")) return "pdf";
          if (contentType.includes("html")) return "html";
          if (contentType.includes("text")) return "text";
          if (contentType.includes("word") || contentType.includes("document")) return "document";
          return "other";
        }
        /**
         * Convert structured result to plain text format
         */
        convertToText(result) {
          const textParts = [];
          if (result.content.abstract) {
            textParts.push(`ABSTRACT:
${result.content.abstract.content}
`);
          }
          if (result.content.attachments) {
            for (const att of result.content.attachments) {
              textParts.push(`ATTACHMENT (${att.filename || att.type}):
${att.content}
`);
            }
          }
          if (result.content.notes) {
            for (const note of result.content.notes) {
              textParts.push(`NOTE (${note.title}):
${note.content}
`);
            }
          }
          if (result.content.webpage) {
            textParts.push(`WEBPAGE:
${result.content.webpage.content}
`);
          }
          return textParts.join("\n---\n\n");
        }
        /**
         * Get mode-specific configuration
         */
        getModeConfiguration(mode) {
          const presets = MCPSettingsService.getEffectiveSettings();
          const modeConfigs = {
            "minimal": {
              maxContentLength: 500,
              maxAttachments: 2,
              maxNotes: 3,
              includeWebpage: false,
              enableCompression: true
            },
            "preview": {
              maxContentLength: 1500,
              maxAttachments: 5,
              maxNotes: 8,
              includeWebpage: false,
              enableCompression: true
            },
            "standard": {
              maxContentLength: 3e3,
              maxAttachments: 10,
              maxNotes: 15,
              includeWebpage: true,
              enableCompression: true
            },
            "complete": {
              maxContentLength: -1,
              // No limit
              maxAttachments: -1,
              // No limit
              maxNotes: -1,
              // No limit
              includeWebpage: true,
              enableCompression: false
            }
          };
          return modeConfigs[mode] || modeConfigs["standard"];
        }
        /**
         * Smart truncation that preserves sentence boundaries and meaning
         */
        smartTruncate(content, maxLength) {
          if (!content || content.length <= maxLength) {
            return content;
          }
          const truncated = content.substring(0, maxLength);
          const lastSentence = Math.max(
            truncated.lastIndexOf("."),
            truncated.lastIndexOf("!"),
            truncated.lastIndexOf("?")
          );
          if (lastSentence > maxLength * 0.7) {
            return truncated.substring(0, lastSentence + 1);
          }
          const lastSpace = truncated.lastIndexOf(" ");
          if (lastSpace > maxLength * 0.8) {
            return truncated.substring(0, lastSpace) + "...";
          }
          return truncated + "...";
        }
      };
    }
  });

  // src/modules/annotationService.ts
  var AnnotationService;
  var init_annotationService = __esm({
    "src/modules/annotationService.ts"() {
      "use strict";
      init_textFormatter();
      AnnotationService = class {
        /**
         * 智能截断文本，保留完整句子
         */
        smartTruncate(text, maxLength = 200) {
          if (!text || text.length <= maxLength) return text;
          const truncated = text.substring(0, maxLength);
          const lastPeriod = Math.max(
            truncated.lastIndexOf("\u3002"),
            truncated.lastIndexOf("."),
            truncated.lastIndexOf("\n")
          );
          if (lastPeriod > maxLength * 0.6) {
            return truncated.substring(0, lastPeriod + 1) + "...";
          }
          return truncated + "...";
        }
        /**
         * 提取关键词
         */
        extractKeywords(text, maxCount = 5) {
          if (!text) return [];
          const stopWords = /* @__PURE__ */ new Set([
            "\u7684",
            "\u4E86",
            "\u5728",
            "\u662F",
            "\u548C",
            "\u4E0E",
            "\u6216",
            "\u4F46",
            "\u7136\u800C",
            "\u56E0\u6B64",
            "\u6240\u4EE5",
            "the",
            "a",
            "an",
            "and",
            "or",
            "but",
            "in",
            "on",
            "at",
            "to",
            "for",
            "of",
            "with"
          ]);
          const words = text.toLowerCase().replace(/[^\w\s\u4e00-\u9fa5]/g, " ").split(/\s+/).filter((word) => word.length > 1 && !stopWords.has(word));
          const wordCount = /* @__PURE__ */ new Map();
          words.forEach((word) => {
            wordCount.set(word, (wordCount.get(word) || 0) + 1);
          });
          return Array.from(wordCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, maxCount).map(([word]) => word);
        }
        /**
         * 处理注释内容，根据需要返回简化或完整版本
         */
        processAnnotationContent(annotation, detailed = false) {
          if (detailed) {
            return annotation;
          }
          const processed = {
            ...annotation,
            content: this.smartTruncate(annotation.content),
            text: annotation.text ? this.smartTruncate(annotation.text, 150) : annotation.text,
            comment: annotation.comment ? this.smartTruncate(annotation.comment, 100) : annotation.comment
          };
          processed.contentMeta = {
            isPreview: !detailed,
            originalLength: annotation.content?.length || 0,
            textLength: annotation.text?.length || 0,
            commentLength: annotation.comment?.length || 0,
            keywords: this.extractKeywords(annotation.content + " " + (annotation.text || "") + " " + (annotation.comment || ""))
          };
          return processed;
        }
        /**
         * 获取所有笔记内容
         * @param itemKey 可选，特定文献的笔记
         * @returns 笔记列表
         */
        async getAllNotes(itemKey) {
          try {
            ztoolkit.log(
              `[AnnotationService] Getting all notes${itemKey ? " for item " + itemKey : ""}`
            );
            let items;
            if (itemKey) {
              const parentItem = Zotero.Items.getByLibraryAndKey(
                Zotero.Libraries.userLibraryID,
                itemKey
              );
              if (!parentItem) {
                throw new Error(`Item with key ${itemKey} not found`);
              }
              const noteIds = parentItem.getNotes(false);
              items = noteIds.map((id) => Zotero.Items.get(id)).filter(Boolean);
            } else {
              const search = new Zotero.Search();
              search.libraryID = Zotero.Libraries.userLibraryID;
              search.addCondition("itemType", "is", "note");
              const itemIds = await search.search();
              items = await Zotero.Items.getAsync(itemIds);
            }
            const notes = [];
            for (const item of items) {
              try {
                const noteContent = this.formatNoteItem(item);
                if (noteContent) {
                  notes.push(noteContent);
                }
              } catch (e) {
                ztoolkit.log(
                  `[AnnotationService] Error processing note ${item.id}: ${e}`,
                  "error"
                );
              }
            }
            ztoolkit.log(`[AnnotationService] Found ${notes.length} notes`);
            return notes;
          } catch (error) {
            ztoolkit.log(
              `[AnnotationService] Error getting notes: ${error}`,
              "error"
            );
            throw error;
          }
        }
        /**
         * 获取PDF注释和高亮
         * @param itemKey PDF文献的Key
         * @returns 注释列表
         */
        async getPDFAnnotations(itemKey) {
          try {
            ztoolkit.log(
              `[AnnotationService] Getting PDF annotations for ${itemKey}`
            );
            const item = Zotero.Items.getByLibraryAndKey(
              Zotero.Libraries.userLibraryID,
              itemKey
            );
            if (!item) {
              throw new Error(`Item with key ${itemKey} not found`);
            }
            const annotations = [];
            const attachmentIds = item.getAttachments();
            for (const attachmentId of attachmentIds) {
              try {
                const attachment = Zotero.Items.get(attachmentId);
                if (!attachment || !attachment.isPDFAttachment()) {
                  continue;
                }
                const annotationItems = attachment.getAnnotations();
                for (const annotationItem of annotationItems) {
                  try {
                    const annotationContent = this.formatAnnotationItem(
                      annotationItem,
                      attachment.key
                    );
                    if (annotationContent) {
                      annotations.push(annotationContent);
                    }
                  } catch (e) {
                    ztoolkit.log(
                      `[AnnotationService] Error processing annotation ${annotationItem.id}: ${e}`,
                      "error"
                    );
                  }
                }
              } catch (e) {
                ztoolkit.log(
                  `[AnnotationService] Error processing attachment ${attachmentId}: ${e}`,
                  "error"
                );
              }
            }
            annotations.sort((a, b) => {
              if (a.page !== b.page) {
                return (a.page || 0) - (b.page || 0);
              }
              return (a.sortIndex || 0) - (b.sortIndex || 0);
            });
            ztoolkit.log(
              `[AnnotationService] Found ${annotations.length} PDF annotations`
            );
            return annotations;
          } catch (error) {
            ztoolkit.log(
              `[AnnotationService] Error getting PDF annotations: ${error}`,
              "error"
            );
            throw error;
          }
        }
        /**
         * 搜索注释和高亮内容
         * @param params 搜索参数
         * @returns 搜索结果
         */
        async searchAnnotations(params) {
          const startTime = Date.now();
          ztoolkit.log(
            `[AnnotationService] Searching annotations with params: ${JSON.stringify(params)}`
          );
          try {
            const allAnnotations = [];
            if (!params.type || params.type === "note" || Array.isArray(params.type) && params.type.includes("note")) {
              const notes = await this.getAllNotes(params.itemKey);
              allAnnotations.push(...notes);
            }
            if (!params.type || params.type !== "note") {
              if (params.itemKey) {
                const pdfAnnotations = await this.getPDFAnnotations(params.itemKey);
                allAnnotations.push(...pdfAnnotations);
              } else {
                const allItems = await Zotero.Items.getAll(
                  Zotero.Libraries.userLibraryID
                );
                for (const item of allItems.slice(0, 50)) {
                  if (item.isRegularItem() && !item.isNote() && !item.isAttachment()) {
                    try {
                      const pdfAnnotations = await this.getPDFAnnotations(item.key);
                      allAnnotations.push(...pdfAnnotations);
                    } catch (e) {
                    }
                  }
                }
              }
            }
            let filteredAnnotations = this.filterAnnotations(allAnnotations, params);
            if (params.q) {
              filteredAnnotations = this.searchInAnnotations(
                filteredAnnotations,
                params.q
              );
            }
            const detailed = params.detailed === true || String(params.detailed) === "true";
            const sort = params.sort || "dateModified";
            const direction = params.direction || "desc";
            this.sortAnnotations(filteredAnnotations, sort, direction);
            const defaultLimit = detailed ? "50" : "20";
            const limit = Math.min(parseInt(params.limit || defaultLimit, 10), detailed ? 200 : 100);
            const offset = parseInt(params.offset || "0", 10);
            const totalCount = filteredAnnotations.length;
            const paginatedResults = filteredAnnotations.slice(
              offset,
              offset + limit
            );
            const processedResults = paginatedResults.map(
              (annotation) => this.processAnnotationContent(annotation, detailed)
            );
            const searchTime = `${Date.now() - startTime}ms`;
            ztoolkit.log(
              `[AnnotationService] Search completed in ${searchTime}, found ${totalCount} results (detailed: ${detailed})`
            );
            return {
              // 元数据信息放在最前面
              pagination: {
                limit,
                offset,
                total: totalCount,
                hasMore: offset + limit < totalCount
              },
              searchTime,
              totalCount,
              contentMode: detailed ? "full" : "preview",
              version: "2.0",
              endpoint: "annotations/search",
              // 实际数据放在后面
              results: processedResults
            };
          } catch (error) {
            ztoolkit.log(
              `[AnnotationService] Error searching annotations: ${error}`,
              "error"
            );
            throw error;
          }
        }
        /**
         * 格式化笔记项目
         */
        formatNoteItem(item) {
          try {
            const noteText = item.getNote() || "";
            if (!noteText.trim()) {
              return null;
            }
            const textContent = TextFormatter.htmlToText(noteText, {
              preserveParagraphs: true,
              preserveHeadings: false,
              // 注释中通常不需要标题格式
              preserveLists: true,
              preserveEmphasis: false
            });
            return {
              id: item.key,
              itemKey: item.key,
              parentKey: item.parentKey || void 0,
              type: "note",
              content: noteText,
              text: textContent,
              tags: item.getTags().map((t) => t.tag),
              dateAdded: item.dateAdded,
              dateModified: item.dateModified
            };
          } catch (error) {
            ztoolkit.log(
              `[AnnotationService] Error formatting note item: ${error}`,
              "error"
            );
            return null;
          }
        }
        /**
         * 格式化注释项目
         */
        formatAnnotationItem(item, parentKey) {
          try {
            if (!item.isAnnotation()) {
              return null;
            }
            const annotationText = item.annotationText || "";
            const annotationComment = item.annotationComment || "";
            const annotationType = item.annotationType;
            const annotationColor = item.annotationColor || "";
            const annotationPageLabel = item.annotationPageLabel;
            const annotationSortIndex = item.annotationSortIndex;
            if (!annotationText.trim() && !annotationComment.trim()) {
              return null;
            }
            let type = "annotation";
            switch (annotationType) {
              case "highlight":
                type = "highlight";
                break;
              case "note":
                type = "text";
                break;
              case "image":
                type = "image";
                break;
              case "ink":
                type = "ink";
                break;
              default:
                type = "annotation";
                break;
            }
            return {
              id: item.key,
              itemKey: item.key,
              parentKey,
              type,
              content: annotationComment || annotationText,
              text: annotationText,
              comment: annotationComment,
              color: annotationColor,
              tags: item.getTags().map((t) => t.tag),
              dateAdded: item.dateAdded,
              dateModified: item.dateModified,
              page: annotationPageLabel ? parseInt(annotationPageLabel, 10) : void 0,
              sortIndex: annotationSortIndex
            };
          } catch (error) {
            ztoolkit.log(
              `[AnnotationService] Error formatting annotation item: ${error}`,
              "error"
            );
            return null;
          }
        }
        /**
         * 过滤注释
         */
        filterAnnotations(annotations, params) {
          return annotations.filter((annotation) => {
            if (params.type) {
              const types = Array.isArray(params.type) ? params.type : [params.type];
              if (!types.includes(annotation.type)) {
                return false;
              }
            }
            if (params.tags) {
              const searchTags = Array.isArray(params.tags) ? params.tags : [params.tags];
              const hasMatchingTag = searchTags.some(
                (searchTag) => annotation.tags.some(
                  (tag) => tag.toLowerCase().includes(searchTag.toLowerCase())
                )
              );
              if (!hasMatchingTag) {
                return false;
              }
            }
            if (params.color && annotation.color !== params.color) {
              return false;
            }
            if (params.hasComment !== void 0) {
              const hasComment = !!(annotation.comment && annotation.comment.trim());
              if (params.hasComment !== hasComment) {
                return false;
              }
            }
            if (params.dateRange) {
              const [startDate, endDate] = params.dateRange.split(",").map((d) => new Date(d.trim()));
              const itemDate = new Date(annotation.dateModified);
              if (startDate && itemDate < startDate) return false;
              if (endDate && itemDate > endDate) return false;
            }
            return true;
          });
        }
        /**
         * 在注释中搜索
         */
        searchInAnnotations(annotations, query) {
          const lowerQuery = query.toLowerCase();
          return annotations.filter((annotation) => {
            const searchFields = [
              annotation.content,
              annotation.text,
              annotation.comment,
              annotation.tags.join(" ")
            ].filter(Boolean);
            return searchFields.some(
              (field) => field && field.toLowerCase().includes(lowerQuery)
            );
          });
        }
        /**
         * 排序注释
         */
        sortAnnotations(annotations, sort, direction) {
          annotations.sort((a, b) => {
            let valueA, valueB;
            switch (sort) {
              case "dateAdded":
                valueA = new Date(a.dateAdded);
                valueB = new Date(b.dateAdded);
                break;
              case "dateModified":
                valueA = new Date(a.dateModified);
                valueB = new Date(b.dateModified);
                break;
              case "position":
                valueA = (a.page || 0) * 1e3 + (a.sortIndex || 0);
                valueB = (b.page || 0) * 1e3 + (b.sortIndex || 0);
                break;
              case "type":
                valueA = a.type;
                valueB = b.type;
                break;
              default:
                valueA = a.dateModified;
                valueB = b.dateModified;
                break;
            }
            if (valueA < valueB) return direction === "asc" ? -1 : 1;
            if (valueA > valueB) return direction === "asc" ? 1 : -1;
            return 0;
          });
        }
        /**
         * 根据ID获取注释的完整内容
         */
        async getAnnotationById(annotationId) {
          try {
            ztoolkit.log(`[AnnotationService] Getting annotation by ID: ${annotationId}`);
            const notes = await this.getAllNotes();
            const note = notes.find((n) => n.id === annotationId);
            if (note) {
              return note;
            }
            const allItems = await Zotero.Items.getAll(Zotero.Libraries.userLibraryID);
            for (const item of allItems.slice(0, 100)) {
              if (item.isRegularItem() && !item.isNote() && !item.isAttachment()) {
                try {
                  const annotations = await this.getPDFAnnotations(item.key);
                  const annotation = annotations.find((a) => a.id === annotationId);
                  if (annotation) {
                    return annotation;
                  }
                } catch (e) {
                }
              }
            }
            return null;
          } catch (error) {
            ztoolkit.log(`[AnnotationService] Error getting annotation by ID: ${error}`, "error");
            throw error;
          }
        }
        /**
         * 批量获取注释的完整内容
         */
        async getAnnotationsByIds(annotationIds) {
          try {
            ztoolkit.log(`[AnnotationService] Getting annotations by IDs: ${annotationIds.join(", ")}`);
            const results = [];
            for (const id of annotationIds) {
              const annotation = await this.getAnnotationById(id);
              if (annotation) {
                results.push(annotation);
              }
            }
            return results;
          } catch (error) {
            ztoolkit.log(`[AnnotationService] Error getting annotations by IDs: ${error}`, "error");
            throw error;
          }
        }
      };
    }
  });

  // src/modules/smartAnnotationExtractor.ts
  var SmartAnnotationExtractor;
  var init_smartAnnotationExtractor = __esm({
    "src/modules/smartAnnotationExtractor.ts"() {
      "use strict";
      init_annotationService();
      init_mcpSettingsService();
      SmartAnnotationExtractor = class {
        annotationService;
        constructor() {
          this.annotationService = new AnnotationService();
        }
        /**
         * Unified annotation retrieval (replaces 4 old tools)
         */
        async getAnnotations(params) {
          const startTime = Date.now();
          try {
            ztoolkit.log(`[SmartAnnotationExtractor] getAnnotations called with params: ${JSON.stringify(params)}`);
            const effectiveSettings = MCPSettingsService.getEffectiveSettings();
            const options = {
              maxTokens: params.maxTokens || effectiveSettings.maxTokens,
              outputMode: params.outputMode || MCPSettingsService.get("content.mode"),
              types: params.types || ["note", "highlight", "annotation"],
              limit: params.limit || (MCPSettingsService.get("content.mode") === "complete" ? effectiveSettings.maxAnnotationsPerRequest : 20),
              offset: params.offset || 0
            };
            ztoolkit.log(`[SmartAnnotationExtractor] Using settings - maxTokens: ${options.maxTokens}, mode: ${options.outputMode}`);
            let annotations = [];
            if (params.annotationId) {
              annotations = await this.getById(params.annotationId);
            } else if (params.annotationIds) {
              annotations = await this.getByIds(params.annotationIds);
            } else if (params.itemKey) {
              annotations = await this.getByItem(params.itemKey, options);
            } else {
              throw new Error("Must provide itemKey, annotationId, or annotationIds");
            }
            if (options.types && options.types.length > 0) {
              annotations = annotations.filter((ann) => options.types.includes(ann.type));
            }
            const totalCount = annotations.length;
            let paginatedAnnotations;
            if (options.outputMode === "full") {
              paginatedAnnotations = annotations;
            } else {
              paginatedAnnotations = annotations.slice(options.offset, options.offset + options.limit);
            }
            const processed = await this.processAnnotations(paginatedAnnotations, options);
            const processingTime = `${Date.now() - startTime}ms`;
            ztoolkit.log(`[SmartAnnotationExtractor] Completed in ${processingTime}, processed ${processed.includedCount} of ${totalCount} annotations (paginated: ${paginatedAnnotations.length})`);
            const hasMore = options.outputMode !== "full" && options.offset + options.limit < totalCount;
            const nextOffset = hasMore ? options.offset + options.limit : void 0;
            return {
              ...processed,
              metadata: {
                extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
                userSettings: {
                  maxTokens: options.maxTokens,
                  outputMode: options.outputMode
                },
                processingTime,
                pagination: {
                  total: totalCount,
                  offset: options.offset,
                  limit: options.limit,
                  hasMore,
                  nextOffset
                },
                stats: {
                  foundCount: totalCount,
                  filteredCount: paginatedAnnotations.length,
                  returnedCount: processed.includedCount,
                  skippedCount: processed.originalCount ? processed.originalCount - processed.includedCount : void 0
                }
              }
            };
          } catch (error) {
            ztoolkit.log(`[SmartAnnotationExtractor] Error in getAnnotations: ${error}`, "error");
            throw error;
          }
        }
        /**
         * Intelligent search with relevance scoring
         */
        async searchAnnotations(query, options = {}) {
          const startTime = Date.now();
          try {
            ztoolkit.log(`[SmartAnnotationExtractor] searchAnnotations called: "${query}"`);
            const effectiveSettings = MCPSettingsService.getEffectiveSettings();
            const searchOptions = {
              maxTokens: options.maxTokens || effectiveSettings.maxTokens,
              outputMode: options.outputMode || MCPSettingsService.get("content.mode"),
              types: options.types || ["note", "highlight", "annotation"],
              minRelevance: options.minRelevance || 0.1,
              limit: options.limit || (MCPSettingsService.get("content.mode") === "complete" ? effectiveSettings.maxAnnotationsPerRequest : 15),
              offset: options.offset || 0
            };
            const searchParams = {
              q: query,
              itemKey: options.itemKeys?.[0],
              // For now, use first itemKey if provided
              type: searchOptions.types,
              detailed: false,
              // We'll handle detail level ourselves
              limit: "100",
              // Get more results to score and filter
              offset: "0"
            };
            const searchResult = await this.annotationService.searchAnnotations(searchParams);
            let annotations = searchResult.results || [];
            const scoredAnnotations = annotations.map((ann) => ({
              ...ann,
              relevance: this.calculateRelevance(ann, query),
              importance: this.calculateImportance(ann)
            })).filter((ann) => ann.relevance >= searchOptions.minRelevance);
            scoredAnnotations.sort((a, b) => {
              const scoreA = a.relevance * 0.7 + a.importance * 0.3;
              const scoreB = b.relevance * 0.7 + b.importance * 0.3;
              return scoreB - scoreA;
            });
            const totalCount = scoredAnnotations.length;
            let paginatedAnnotations;
            if (searchOptions.outputMode === "full") {
              paginatedAnnotations = scoredAnnotations;
            } else {
              paginatedAnnotations = scoredAnnotations.slice(searchOptions.offset, searchOptions.offset + searchOptions.limit);
            }
            const processed = await this.processAnnotations(paginatedAnnotations, searchOptions);
            const processingTime = `${Date.now() - startTime}ms`;
            ztoolkit.log(`[SmartAnnotationExtractor] Search completed in ${processingTime}, found ${processed.includedCount} relevant results of ${totalCount} total (paginated: ${paginatedAnnotations.length})`);
            const hasMore = searchOptions.outputMode !== "full" && searchOptions.offset + searchOptions.limit < totalCount;
            const nextOffset = hasMore ? searchOptions.offset + searchOptions.limit : void 0;
            return {
              ...processed,
              metadata: {
                extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
                userSettings: {
                  maxTokens: searchOptions.maxTokens,
                  outputMode: searchOptions.outputMode,
                  minRelevance: searchOptions.minRelevance
                },
                processingTime,
                pagination: {
                  total: totalCount,
                  offset: searchOptions.offset,
                  limit: searchOptions.limit,
                  hasMore,
                  nextOffset
                },
                stats: {
                  foundCount: searchResult.results?.length || 0,
                  filteredCount: totalCount,
                  // 已过滤过相关性的数量
                  returnedCount: processed.includedCount,
                  skippedCount: processed.originalCount ? processed.originalCount - processed.includedCount : void 0
                }
              }
            };
          } catch (error) {
            ztoolkit.log(`[SmartAnnotationExtractor] Error in searchAnnotations: ${error}`, "error");
            throw error;
          }
        }
        /**
         * Get annotation by single ID
         */
        async getById(annotationId) {
          const annotation = await this.annotationService.getAnnotationById(annotationId);
          return annotation ? [annotation] : [];
        }
        /**
         * Get annotations by multiple IDs
         */
        async getByIds(annotationIds) {
          return await this.annotationService.getAnnotationsByIds(annotationIds);
        }
        /**
         * Get annotations by item (PDF annotations + notes)
         */
        async getByItem(itemKey, options) {
          const annotations = [];
          if (options.types.includes("note")) {
            try {
              const notes = await this.annotationService.getAllNotes(itemKey);
              annotations.push(...notes);
            } catch (error) {
              ztoolkit.log(`[SmartAnnotationExtractor] Error getting notes for ${itemKey}: ${error}`, "warn");
            }
          }
          const pdfTypes = ["highlight", "annotation", "ink", "text", "image"];
          if (options.types.some((type) => pdfTypes.includes(type))) {
            try {
              const pdfAnnotations = await this.annotationService.getPDFAnnotations(itemKey);
              const filteredPdfAnnotations = pdfAnnotations.filter((ann) => options.types.includes(ann.type));
              annotations.push(...filteredPdfAnnotations);
            } catch (error) {
              ztoolkit.log(`[SmartAnnotationExtractor] Error getting PDF annotations for ${itemKey}: ${error}`, "warn");
            }
          }
          return annotations;
        }
        /**
         * Smart content processing and compression
         */
        async processAnnotations(annotations, options) {
          if (annotations.length === 0) {
            return {
              mode: "empty",
              includedCount: 0,
              estimatedTokens: 0,
              data: [],
              metadata: {
                extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
                userSettings: {
                  maxTokens: options.maxTokens,
                  outputMode: options.outputMode
                },
                processingTime: "0ms",
                stats: {
                  foundCount: 0,
                  filteredCount: 0,
                  returnedCount: 0
                }
              }
            };
          }
          const scoredAnnotations = annotations.map((ann) => ({
            ...ann,
            importance: this.calculateImportance(ann)
          }));
          const fullTokens = this.estimateTokens(scoredAnnotations);
          if (fullTokens <= options.maxTokens || options.outputMode === "full") {
            const processedAnnotations = scoredAnnotations.map((ann) => this.formatAnnotation(ann, "full"));
            return {
              mode: fullTokens <= options.maxTokens ? "full_within_budget" : "full_forced",
              includedCount: processedAnnotations.length,
              estimatedTokens: fullTokens,
              data: processedAnnotations,
              metadata: {
                extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
                userSettings: {
                  maxTokens: options.maxTokens,
                  outputMode: options.outputMode
                },
                processingTime: "0ms",
                stats: {
                  foundCount: annotations.length,
                  filteredCount: annotations.length,
                  returnedCount: processedAnnotations.length
                }
              }
            };
          }
          return this.smartCompress(scoredAnnotations, options.maxTokens, options.outputMode);
        }
        /**
         * Smart compression algorithm
         */
        smartCompress(annotations, maxTokens, outputMode) {
          const sortedAnnotations = [...annotations].sort((a, b) => b.importance - a.importance);
          const result = [];
          let tokenBudget = maxTokens;
          let skipped = 0;
          for (const annotation of sortedAnnotations) {
            let processMode = this.selectProcessingMode(tokenBudget, annotation.importance, outputMode);
            if (processMode === "skip") {
              skipped++;
              continue;
            }
            const processed = this.formatAnnotation(annotation, processMode);
            const estimatedTokens = this.estimateTokens([processed]);
            if (estimatedTokens <= tokenBudget) {
              result.push(processed);
              tokenBudget -= estimatedTokens;
            } else if (tokenBudget > 100) {
              const minimal = this.formatAnnotation(annotation, "minimal");
              const minimalTokens = this.estimateTokens([minimal]);
              if (minimalTokens <= tokenBudget) {
                result.push(minimal);
                tokenBudget -= minimalTokens;
              } else {
                skipped++;
              }
            } else {
              skipped++;
            }
          }
          const compressionRatio = `${Math.round(result.length / annotations.length * 100)}%`;
          return {
            mode: "smart_compressed",
            originalCount: annotations.length,
            includedCount: result.length,
            estimatedTokens: maxTokens - tokenBudget,
            compressionRatio,
            data: result,
            metadata: {
              extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
              userSettings: {
                maxTokens,
                outputMode
              },
              processingTime: "0ms",
              stats: {
                foundCount: annotations.length,
                filteredCount: annotations.length,
                returnedCount: result.length,
                skippedCount: annotations.length - result.length
              }
            }
          };
        }
        /**
         * Calculate importance score for an annotation
         */
        calculateImportance(annotation) {
          let score = 0;
          const contentLength = (annotation.content || "").length;
          score += Math.min(contentLength, 500) / 500 * 0.3;
          const typeScores = {
            note: 0.4,
            // Notes are usually more important
            highlight: 0.3,
            // Highlights are selective
            annotation: 0.2,
            ink: 0.15,
            text: 0.25,
            image: 0.1
          };
          score += typeScores[annotation.type] || 0.2;
          if (annotation.comment && annotation.comment.trim()) {
            score += 0.2;
          }
          const daysSinceModified = (Date.now() - new Date(annotation.dateModified).getTime()) / (1e3 * 60 * 60 * 24);
          score += Math.max(0, (30 - daysSinceModified) / 30) * 0.1;
          return Math.min(score, 1);
        }
        /**
         * Calculate relevance score for search
         */
        calculateRelevance(annotation, query) {
          const lowerQuery = query.toLowerCase();
          let score = 0;
          if (annotation.content?.toLowerCase().includes(lowerQuery)) {
            score += 0.6;
          }
          if (annotation.comment?.toLowerCase().includes(lowerQuery)) {
            score += 0.4;
          }
          const queryWords = lowerQuery.split(/\s+/).filter((w) => w.length > 1);
          const contentWords = (annotation.content + " " + (annotation.comment || "")).toLowerCase().split(/\s+/);
          const matches = queryWords.filter(
            (qw) => contentWords.some((cw) => cw.includes(qw) || qw.includes(cw))
          ).length;
          if (queryWords.length > 0) {
            score += matches / queryWords.length * 0.3;
          }
          return Math.min(score, 1);
        }
        /**
         * Select processing mode based on budget and importance
         */
        selectProcessingMode(availableTokens, importance, userMode) {
          if (userMode === "minimal") return "minimal";
          if (userMode === "full") return "full";
          if (availableTokens > 500 && importance > 0.6) return "full";
          if (availableTokens > 200 && importance > 0.3) return "preview";
          if (availableTokens > 80) return "minimal";
          return "skip";
        }
        /**
         * Format annotation according to processing mode
         */
        formatAnnotation(annotation, mode) {
          const base = {
            id: annotation.id,
            type: annotation.type,
            content: "",
            itemKey: annotation.itemKey,
            parentKey: annotation.parentKey,
            page: annotation.page,
            dateModified: annotation.dateModified
          };
          switch (mode) {
            case "minimal":
              base.content = this.smartTruncate(annotation.content || annotation.text || "", 50);
              base.keywords = this.extractKeywords(annotation.content || annotation.text || "", 2);
              break;
            case "preview":
              base.content = this.smartTruncate(annotation.content || annotation.text || "", 150);
              base.keywords = this.extractKeywords(
                (annotation.content || "") + " " + (annotation.comment || "") + " " + (annotation.text || ""),
                5
              );
              base.importance = annotation.importance;
              break;
            case "full":
              base.content = annotation.content || annotation.text || "";
              if (annotation.comment && annotation.comment !== base.content) {
                base.content += annotation.comment ? `

Comment: ${annotation.comment}` : "";
              }
              base.keywords = this.extractKeywords(base.content, 8);
              base.importance = annotation.importance;
              break;
            default:
              base.content = annotation.content || annotation.text || "";
              break;
          }
          return base;
        }
        /**
         * Smart truncation that preserves sentence boundaries
         */
        smartTruncate(text, maxLength) {
          if (!text || text.length <= maxLength) return text;
          const truncated = text.substring(0, maxLength);
          const lastSentence = Math.max(
            truncated.lastIndexOf("\u3002"),
            truncated.lastIndexOf("."),
            truncated.lastIndexOf("\n")
          );
          if (lastSentence > maxLength * 0.6) {
            return truncated.substring(0, lastSentence + 1) + "...";
          }
          return truncated + "...";
        }
        /**
         * Extract keywords from text
         */
        extractKeywords(text, maxCount) {
          if (!text) return [];
          const stopWords = /* @__PURE__ */ new Set([
            "the",
            "a",
            "an",
            "and",
            "or",
            "but",
            "in",
            "on",
            "at",
            "to",
            "for",
            "of",
            "with",
            "by",
            "\u7684",
            "\u4E86",
            "\u5728",
            "\u662F",
            "\u548C",
            "\u4E0E",
            "\u6216",
            "\u4F46",
            "\u7136\u800C",
            "\u56E0\u6B64",
            "\u6240\u4EE5",
            "\u8FD9",
            "\u90A3",
            "\u6709",
            "\u6CA1\u6709"
          ]);
          const words = text.toLowerCase().replace(/[^\w\s\u4e00-\u9fa5]/g, " ").split(/\s+/).filter((word) => word.length > 1 && !stopWords.has(word));
          const wordCount = /* @__PURE__ */ new Map();
          words.forEach((word) => {
            wordCount.set(word, (wordCount.get(word) || 0) + 1);
          });
          return Array.from(wordCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, maxCount).map(([word]) => word);
        }
        /**
         * Estimate token count for content
         */
        estimateTokens(content) {
          const text = JSON.stringify(content);
          return Math.ceil(text.length / 3.5);
        }
      };
    }
  });

  // src/modules/aiInstructionsManager.ts
  var AIInstructionsManager;
  var init_aiInstructionsManager = __esm({
    "src/modules/aiInstructionsManager.ts"() {
      "use strict";
      AIInstructionsManager = class {
        /**
         * Get global AI instructions for all MCP responses
         */
        static getGlobalInstructions() {
          return {
            dataIntegrity: "VERIFIED_FROM_ZOTERO_USER_LIBRARY",
            usage: [
              "This content is from the user's personal Zotero research library",
              "You can analyze, summarize, and interpret this content to help the user",
              "When quoting directly, use proper attribution to the source",
              "Feel free to extract key insights and connections between sources",
              "Use pagination when needed to access complete datasets"
            ],
            constraints: [
              "Maintain accuracy when referencing specific details from sources",
              "Distinguish between user's personal notes and published content when relevant",
              "Preserve important citation metadata for academic references",
              "Respect the user's research organization and collection structure"
            ],
            warnings: [
              "Large datasets may be paginated - check metadata for pagination info",
              "Content from PDFs may contain OCR errors or formatting artifacts",
              "Annotation content represents user's personal research insights",
              "Some results may be compressed based on relevance and importance"
            ]
          };
        }
        /**
         * Enhance any metadata object with AI guidelines (全局应用)
         */
        static enhanceMetadataWithAIGuidelines(metadata) {
          const globalInstructions = this.getGlobalInstructions();
          return {
            ...metadata,
            aiGuidelines: {
              ...globalInstructions,
              verification: {
                extractedAt: metadata.extractedAt || (/* @__PURE__ */ new Date()).toISOString(),
                sourceSystem: "Zotero Personal Library",
                userLibrary: true,
                contentHash: this.generateContentHash(metadata)
              }
            }
          };
        }
        /**
         * Generate a simple content hash for verification
         */
        static generateContentHash(data) {
          try {
            const content = JSON.stringify(data);
            let hash = 0;
            for (let i = 0; i < content.length; i++) {
              const char = content.charCodeAt(i);
              hash = (hash << 5) - hash + char;
              hash = hash & hash;
            }
            return Math.abs(hash).toString(16);
          } catch (error) {
            ztoolkit.log(`[AIInstructions] Error generating content hash: ${error}`, "warn");
            return "unknown";
          }
        }
        /**
         * Apply global protection to any response data
         */
        static protectResponseData(responseData) {
          return {
            ...responseData,
            _dataIntegrity: "VERIFIED_FROM_ZOTERO_LIBRARY",
            _instructions: "RESEARCH_DATA_FROM_USER_LIBRARY"
          };
        }
      };
    }
  });

  // src/modules/citationFormatter.ts
  async function generateCitation(item, style2 = "apa", format = "text") {
    const startTime = Date.now();
    ztoolkit.log(`[CitationFormatter] Generating ${style2} citation for item: ${item.key}`);
    try {
      if (style2 === "bibtex" || format === "bibtex") {
        return generateBibTeX(item, "text");
      }
      let citation;
      try {
        if (typeof item.getCitation === "function") {
          citation = await item.getCitation(style2);
        } else {
          citation = constructCitation(item, style2);
        }
      } catch (citationError) {
        ztoolkit.log(`[CitationFormatter] CSL citation error, using fallback: ${citationError}`);
        citation = constructCitation(item, style2);
      }
      let output;
      switch (format) {
        case "html":
          output = citation;
          break;
        default:
          output = stripHtmlTags(citation);
      }
      const metadata = getCitationMetadata(item, style2);
      ztoolkit.log(`[CitationFormatter] Citation generated in ${Date.now() - startTime}ms`);
      return {
        itemKey: item.key,
        title: item.getDisplayTitle(),
        style: style2,
        styleName: getStyleName(style2),
        format,
        citation: output,
        formattedCitation: citation,
        bibtex: generateBibTeX(item, format).citation,
        metadata,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        processingTime: `${Date.now() - startTime}ms`
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      ztoolkit.log(`[CitationFormatter] Error generating citation: ${err.message}`, "error");
      throw err;
    }
  }
  async function generateMultipleCitations(items, style2 = "apa", format = "text") {
    const startTime = Date.now();
    ztoolkit.log(`[CitationFormatter] Generating ${style2} citations for ${items.length} items`);
    const citations = [];
    const errors = [];
    for (const item of items) {
      try {
        const citation = await generateCitation(item, style2, format);
        citations.push(citation);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({
          itemKey: item.key,
          error: err.message
        });
      }
    }
    return {
      style: style2,
      styleName: getStyleName(style2),
      format,
      totalItems: items.length,
      successful: citations.length,
      failed: errors.length,
      citations,
      errors,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      processingTime: `${Date.now() - startTime}ms`
    };
  }
  function generateBibTeX(item, format) {
    const key = generateBibTeXKey(item);
    const entryType = mapItemTypeToBibTeX(item.itemType);
    const creators = item.getCreators();
    const authorParts = [];
    const authorFirstParts = [];
    for (const creator of creators) {
      const lastName = creator.lastName || "";
      const firstName = creator.firstName || "";
      const creatorType = Zotero.CreatorTypes.getName(creator.creatorTypeID);
      if (creatorType === "author") {
        if (lastName && firstName) {
          authorParts.push(`${lastName}, ${firstName}`);
          authorFirstParts.push(`${lastName}, ${firstName.charAt(0)}.`);
        } else if (lastName) {
          authorParts.push(lastName);
          authorFirstParts.push(lastName);
        }
      }
    }
    const author = authorParts.join(" and ");
    const fields = [];
    if (author) fields.push(`  author = {${author}}`);
    if (item.getField("title")) fields.push(`  title = {${item.getField("title")}}`);
    if (item.getField("date")) fields.push(`  year = {${item.getField("date").toString().substring(0, 4)}}`);
    if (item.getField("publicationTitle")) fields.push(`  journal = {${item.getField("publicationTitle")}}`);
    if (item.getField("volume")) fields.push(`  volume = {${item.getField("volume")}}`);
    if (item.getField("issue")) fields.push(`  number = {${item.getField("issue")}}`);
    if (item.getField("pages")) fields.push(`  pages = {${item.getField("pages")}}`);
    if (item.getField("DOI")) fields.push(`  doi = {${item.getField("DOI")}}`);
    if (item.getField("url")) fields.push(`  url = {${item.getField("url")}}`);
    if (item.getField("abstractNote")) {
      const abstract = item.getField("abstractNote").toString().replace(/[\r\n]+/g, " ");
      fields.push(`  abstract = {${abstract.substring(0, 500)}${abstract.length > 500 ? "..." : ""}}`);
    }
    const bibtex = `@${entryType}{${key},
${fields.join(",\n")}
}`;
    return {
      key,
      entryType,
      citation: format === "html" ? `<pre>${bibtex}</pre>` : bibtex,
      formattedCitation: bibtex
    };
  }
  function generateBibTeXKey(item) {
    const creators = item.getCreators();
    let firstAuthor = "";
    for (const creator of creators) {
      const creatorType = Zotero.CreatorTypes.getName(creator.creatorTypeID);
      if (creatorType === "author" && creator.lastName) {
        firstAuthor = creator.lastName.toLowerCase().replace(/[^a-z]/g, "");
        break;
      }
    }
    const year = item.getField("date") ? item.getField("date").toString().substring(0, 4) : "nodate";
    const titleWord = item.getField("title") ? item.getField("title").toString().split(" ")[0].toLowerCase().replace(/[^a-z]/g, "") : "item";
    return `${firstAuthor}${year}${titleWord}`.substring(0, 50);
  }
  function mapItemTypeToBibTeX(itemType) {
    const typeMap = {
      "journalArticle": "article",
      "book": "book",
      "bookSection": "incollection",
      "magazineArticle": "article",
      "newspaperArticle": "article",
      "thesis": "phdthesis",
      "conferencePaper": "inproceedings",
      "report": "techreport",
      "webpage": "misc",
      "document": "misc",
      "email": "misc",
      "audioRecording": "misc",
      "videoRecording": "misc",
      "film": "misc",
      "artwork": "misc",
      "presentation": "misc",
      "interview": "misc",
      "letter": "misc",
      "memo": "misc",
      "note": "misc",
      "attachment": "misc"
    };
    return typeMap[itemType] || "misc";
  }
  function constructCitation(item, style2) {
    const title = item.getField("title") || "Untitled";
    const date = item.getField("date");
    const year = date ? date.toString().substring(0, 4) : "n.d.";
    const creators = item.getCreators();
    const publicationTitle = item.getField("publicationTitle");
    const volume = item.getField("volume");
    const issue = item.getField("issue");
    const pages = item.getField("pages");
    const authorNames = creators.filter((c) => Zotero.CreatorTypes.getName(c.creatorTypeID) === "author").map((c) => {
      if (c.lastName && c.firstName) {
        return `${c.lastName}, ${c.firstName.charAt(0)}.`;
      }
      return c.lastName || "";
    });
    const authorStr = authorNames.join(", ");
    const firstAuthorLast = authorNames[0]?.split(",")[0] || "Unknown";
    switch (style2.toLowerCase()) {
      case "apa":
      case "apa-7":
        if (authorNames.length === 0) {
          return `${title}. (${year}).`;
        } else if (authorNames.length === 1) {
          return `${authorNames[0]}. (${year}). ${title}.`;
        } else if (authorNames.length === 2) {
          return `${authorStr}. (${year}). ${title}.`;
        } else if (authorNames.length <= 20) {
          const allAuthors = authorNames.slice(0, -1).join(", ") + ", & " + authorNames[authorNames.length - 1];
          return `${allAuthors}. (${year}). ${title}.`;
        } else {
          const first19 = authorNames.slice(0, 19).join(", ");
          const last = authorNames[19];
          return `${first19}, ... ${last}. (${year}). ${title}.`;
        }
      case "harvard1":
        if (authorNames.length === 0) {
          return `${title} (${year}).`;
        } else if (authorNames.length === 1) {
          return `${firstAuthorLast} (${year}) ${title}.`;
        } else if (authorNames.length === 2) {
          return `${firstAuthorLast} and ${authorNames[1]} (${year}) ${title}.`;
        } else {
          return `${firstAuthorLast} et al. (${year}) ${title}.`;
        }
      case "chicago-author-date":
        if (authorNames.length === 0) {
          return `${title}. ${year}.`;
        } else if (authorNames.length === 1) {
          return `${firstAuthorLast}. ${year}. "${title}."`;
        } else if (authorNames.length === 2) {
          return `${firstAuthorLast} and ${authorNames[1]}. ${year}. "${title}."`;
        } else {
          return `${firstAuthorLast}, et al. ${year}. "${title}."`;
        }
      case "ieee":
        const ieeeAuthors = authorNames.length <= 6 ? authorNames.join(authorNames.length > 2 ? ", " : " and ") : `${authorNames.slice(0, 6).join(", ")} and ${authorNames.length - 6} others`;
        const pubInfo = publicationTitle ? `${publicationTitle}${volume ? `, ${volume}` : ""}${issue ? `(${issue})` : ""}${pages ? `, ${pages}` : ""}` : "";
        return `${ieeeAuthors}, "${title}"${pubInfo ? `, ${pubInfo}` : ""}.`;
      case "mla":
      case "mla-9":
        if (authorNames.length === 0) {
          return `"${title}." ${year}.`;
        } else if (authorNames.length === 1) {
          return `${firstAuthorLast}. "${title}." ${year}.`;
        } else if (authorNames.length === 2) {
          return `${firstAuthorLast}, and ${authorNames[1]}. "${title}." ${year}.`;
        } else {
          return `${firstAuthorLast}, et al. "${title}." ${year}.`;
        }
      case "nature":
        const natureAuthors = authorNames.length <= 5 ? authorNames.join(", ") : `${firstAuthorLast} et al.`;
        return `${natureAuthors} ${title}. ${publicationTitle || ""}${volume ? ` ${volume}` : ""}${pages ? `, ${pages}` : ""} (${year}).`;
      case "vancouver":
        const vanAuthors = authorNames.length <= 6 ? authorNames.map((n, i) => i === authorNames.length - 1 ? `& ${n}` : n).join(", ") : `${authorNames.slice(0, 6).join(", ")} et al.`;
        return `${vanAuthors}. ${title}. ${publicationTitle || ""}${volume ? ` ${volume}` : ""}${issue ? `(${issue})` : ""}:${pages || ""}. ${year}.`;
      default:
        if (authorNames.length === 0) {
          return `${title} (${year})`;
        } else if (authorNames.length === 1) {
          return `${authorNames[0]}, ${title} (${year})`;
        } else {
          return `${firstAuthorLast} et al., ${title} (${year})`;
        }
    }
  }
  function stripHtmlTags(html) {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
  }
  function getStyleName(style2) {
    const styleNames = {
      "apa": "APA (7th edition)",
      "apa-7": "APA (7th edition)",
      "chicago-author-date": "Chicago (Author-Date)",
      "harvard1": "Harvard",
      "ieee": "IEEE",
      "mla": "MLA (9th edition)",
      "mla-9": "MLA (9th edition)",
      "nature": "Nature",
      "vancouver": "Vancouver",
      "bibtex": "BibTeX"
    };
    return styleNames[style2.toLowerCase()] || style2;
  }
  function getCitationMetadata(item, _style) {
    return {
      itemKey: item.key,
      itemType: item.itemType,
      title: item.getDisplayTitle(),
      authors: item.getCreators().filter((c) => Zotero.CreatorTypes.getName(c.creatorTypeID) === "author").map((c) => ({
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        fullName: `${c.firstName || ""} ${c.lastName || ""}`.trim()
      })),
      date: item.getField("date") || null,
      publicationTitle: item.getField("publicationTitle") || null,
      volume: item.getField("volume") || null,
      issue: item.getField("issue") || null,
      pages: item.getField("pages") || null,
      doi: item.getField("DOI") || null,
      url: item.getField("url") || null,
      zoteroUrl: `zotero://select/library/items/${item.key}`
    };
  }
  function getDefaultStyle() {
    return "apa";
  }
  var init_citationFormatter = __esm({
    "src/modules/citationFormatter.ts"() {
      "use strict";
    }
  });

  // src/modules/pdfMetadataExtractor.ts
  var PDFMetadataExtractor;
  var init_pdfMetadataExtractor = __esm({
    "src/modules/pdfMetadataExtractor.ts"() {
      "use strict";
      init_pdfProcessor();
      PDFMetadataExtractor = class {
        pdfProcessor;
        constructor(ztoolkit2) {
          this.pdfProcessor = new PDFProcessor(ztoolkit2);
        }
        /**
         * 从PDF文件提取元数据
         * @param pdfPath PDF文件的绝对路径
         * @returns Promise<PDFMetadata> 提取的元数据
         */
        async extractMetadata(pdfPath) {
          try {
            ztoolkit.log("[PDFMetadataExtractor] \u5F00\u59CB\u63D0\u53D6PDF\u5143\u6570\u636E:", { pdfPath });
            if (!pdfPath || pdfPath.trim().length === 0) {
              throw new Error("PDF\u8DEF\u5F84\u4E3A\u7A7A");
            }
            const metadata = await this.pdfProcessor.extractMetadata(pdfPath);
            const cleanedMetadata = this.cleanMetadata(metadata);
            ztoolkit.log("[PDFMetadataExtractor] \u5143\u6570\u636E\u63D0\u53D6\u5B8C\u6210:", cleanedMetadata);
            return cleanedMetadata;
          } catch (error) {
            ztoolkit.log("[PDFMetadataExtractor] \u63D0\u53D6\u5931\u8D25:", error, "error");
            return {};
          }
        }
        /**
         * 清理和规范化PDF元数据
         * @param metadata 原始元数据
         * @returns 清理后的元数据
         */
        cleanMetadata(metadata) {
          const cleaned = {};
          if (metadata.title && metadata.title.trim().length > 0) {
            cleaned.title = this.cleanString(metadata.title);
          }
          if (metadata.author && metadata.author.trim().length > 0) {
            cleaned.author = this.cleanString(metadata.author);
          }
          if (metadata.subject && metadata.subject.trim().length > 0) {
            cleaned.subject = this.cleanString(metadata.subject);
          }
          if (metadata.keywords && metadata.keywords.length > 0) {
            cleaned.keywords = metadata.keywords.map((k) => this.cleanString(k)).filter((k) => k.length > 0);
          }
          if (metadata.creator) {
            cleaned.creator = metadata.creator;
          }
          if (metadata.producer) {
            cleaned.producer = metadata.producer;
          }
          if (metadata.creationDate) {
            cleaned.creationDate = this.parsePDFDate(metadata.creationDate);
          }
          if (metadata.modificationDate) {
            cleaned.modificationDate = this.parsePDFDate(metadata.modificationDate);
          }
          if (metadata.pageCount !== void 0 && metadata.pageCount > 0) {
            cleaned.pageCount = metadata.pageCount;
          }
          return cleaned;
        }
        /**
         * 清理字符串（去除多余空格、特殊字符等）
         * @param str 输入字符串
         * @returns 清理后的字符串
         */
        cleanString(str) {
          return str.trim().replace(/\s+/g, " ").replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
        }
        /**
         * 解析PDF日期格式
         * PDF日期格式: D:YYYYMMDDHHmmSSOHH'mm'
         * @param pdfDate PDF日期字符串
         * @returns ISO格式日期字符串
         */
        parsePDFDate(pdfDate) {
          try {
            const match = pdfDate.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
            if (match) {
              const [, year, month, day, hour, minute, second] = match;
              return (/* @__PURE__ */ new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`)).toISOString();
            }
            return pdfDate;
          } catch (error) {
            ztoolkit.log("[PDFMetadataExtractor] \u65E5\u671F\u89E3\u6790\u5931\u8D25:", error, "error");
            return pdfDate;
          }
        }
        /**
         * 从PDF元数据中提取可能的标题
         * @param pdfPath PDF文件路径
         * @returns 可能的标题列表（按优先级排序）
         */
        async extractPossibleTitles(pdfPath) {
          const metadata = await this.extractMetadata(pdfPath);
          const titles = [];
          if (metadata.title) {
            titles.push(metadata.title);
          }
          if (metadata.subject && metadata.subject.length > 10 && metadata.subject.length < 200) {
            titles.push(metadata.subject);
          }
          return titles;
        }
        /**
         * 释放资源
         */
        terminate() {
          if (this.pdfProcessor) {
            this.pdfProcessor.terminate();
          }
        }
      };
    }
  });

  // src/modules/zoteroMetadataRetriever.ts
  var ZoteroMetadataRetriever;
  var init_zoteroMetadataRetriever = __esm({
    "src/modules/zoteroMetadataRetriever.ts"() {
      "use strict";
      init_pdfProcessor();
      ZoteroMetadataRetriever = class {
        pdfProcessor;
        timeout = 3e4;
        // 30秒超时
        constructor(ztoolkit2, timeout) {
          this.pdfProcessor = new PDFProcessor(ztoolkit2);
          if (timeout) {
            this.timeout = timeout;
          }
        }
        /**
         * 从PDF文件检索元数据（使用Zotero的web服务）
         * @param pdfPath PDF文件路径
         * @returns 检索到的元数据，失败返回null
         */
        async retrieveFromPDF(pdfPath) {
          try {
            ztoolkit.log("[ZoteroMetadataRetriever] \u5F00\u59CB\u4ECEPDF\u68C0\u7D22\u5143\u6570\u636E:", { pdfPath });
            const fullText = await this.pdfProcessor.extractText(pdfPath);
            if (!fullText || fullText.trim().length === 0) {
              ztoolkit.log("[ZoteroMetadataRetriever] PDF\u6587\u672C\u4E3A\u7A7A\uFF0C\u65E0\u6CD5\u68C0\u7D22\u5143\u6570\u636E");
              return null;
            }
            const sampleText = fullText.substring(0, 2e3);
            const metadata = await this.recognizeFromText(sampleText);
            if (metadata) {
              ztoolkit.log("[ZoteroMetadataRetriever] \u6210\u529F\u4ECEPDF\u68C0\u7D22\u5143\u6570\u636E");
              return metadata;
            }
            ztoolkit.log("[ZoteroMetadataRetriever] \u65E0\u6CD5\u4ECEPDF\u6587\u672C\u8BC6\u522B\u5143\u6570\u636E");
            return null;
          } catch (error) {
            ztoolkit.log("[ZoteroMetadataRetriever] PDF\u5143\u6570\u636E\u68C0\u7D22\u5931\u8D25:", error, "error");
            return null;
          }
        }
        /**
         * 从DOI检索元数据
         * @param doi DOI标识符
         * @returns 检索到的元数据，失败返回null
         */
        async retrieveFromDOI(doi) {
          try {
            ztoolkit.log("[ZoteroMetadataRetriever] \u4ECEDOI\u68C0\u7D22\u5143\u6570\u636E:", { doi });
            const identifier = {
              itemType: "journalArticle",
              DOI: doi
            };
            const metadata = await this.translateSearch(identifier);
            if (metadata) {
              ztoolkit.log("[ZoteroMetadataRetriever] \u6210\u529F\u4ECEDOI\u68C0\u7D22\u5143\u6570\u636E");
              return metadata;
            }
            return null;
          } catch (error) {
            ztoolkit.log("[ZoteroMetadataRetriever] DOI\u5143\u6570\u636E\u68C0\u7D22\u5931\u8D25:", error, "error");
            return null;
          }
        }
        /**
         * 从ISBN检索元数据
         * @param isbn ISBN标识符
         * @returns 检索到的元数据，失败返回null
         */
        async retrieveFromISBN(isbn) {
          try {
            ztoolkit.log("[ZoteroMetadataRetriever] \u4ECEISBN\u68C0\u7D22\u5143\u6570\u636E:", { isbn });
            const identifier = {
              itemType: "book",
              ISBN: isbn
            };
            const metadata = await this.translateSearch(identifier);
            if (metadata) {
              ztoolkit.log("[ZoteroMetadataRetriever] \u6210\u529F\u4ECEISBN\u68C0\u7D22\u5143\u6570\u636E");
              return metadata;
            }
            return null;
          } catch (error) {
            ztoolkit.log("[ZoteroMetadataRetriever] ISBN\u5143\u6570\u636E\u68C0\u7D22\u5931\u8D25:", error, "error");
            return null;
          }
        }
        /**
         * 从文本识别元数据（用于PDF识别）
         * @param text PDF文本样本
         * @returns 识别到的元数据
         */
        async recognizeFromText(text) {
          try {
            if (typeof Zotero.Recognize !== "undefined" && Zotero.Recognize.recognizeItems) {
              const results = await Promise.race([
                Zotero.Recognize.recognizeItems([{ text }]),
                this.createTimeout("PDF recognition timeout")
              ]);
              if (results && results.length > 0 && results[0]) {
                return this.convertZoteroItem(results[0]);
              }
            }
            return null;
          } catch (error) {
            ztoolkit.log("[ZoteroMetadataRetriever] \u6587\u672C\u8BC6\u522B\u5931\u8D25:", error, "error");
            return null;
          }
        }
        /**
         * 使用Zotero.Translate.Search API检索元数据
         * @param identifier 标识符对象（DOI、ISBN等）
         * @returns 检索到的元数据
         */
        async translateSearch(identifier) {
          try {
            const translate = new Zotero.Translate.Search();
            translate.setIdentifier(identifier);
            const translators = await Promise.race([
              translate.getTranslators(),
              this.createTimeout("Translator lookup timeout")
            ]);
            if (!translators || translators.length === 0) {
              ztoolkit.log("[ZoteroMetadataRetriever] \u672A\u627E\u5230\u5408\u9002\u7684translator");
              return null;
            }
            translate.setTranslator(translators);
            const newItems = await Promise.race([
              translate.translate(),
              this.createTimeout("Translation timeout")
            ]);
            if (!newItems || newItems.length === 0) {
              ztoolkit.log("[ZoteroMetadataRetriever] Translation\u672A\u8FD4\u56DE\u7ED3\u679C");
              return null;
            }
            return this.convertZoteroItem(newItems[0]);
          } catch (error) {
            ztoolkit.log("[ZoteroMetadataRetriever] Translate search\u5931\u8D25:", error, "error");
            return null;
          }
        }
        /**
         * 将Zotero item对象转换为RetrievedMetadata格式
         * @param item Zotero item对象
         * @returns 标准化的元数据对象
         */
        convertZoteroItem(item) {
          const metadata = {
            itemType: item.itemType || "document"
          };
          if (item.title) metadata.title = item.title;
          if (item.date) metadata.date = item.date;
          if (item.abstractNote) metadata.abstractNote = item.abstractNote;
          if (item.url) metadata.url = item.url;
          if (item.language) metadata.language = item.language;
          if (item.rights) metadata.rights = item.rights;
          if (item.publicationTitle) metadata.publicationTitle = item.publicationTitle;
          if (item.volume) metadata.volume = item.volume;
          if (item.issue) metadata.issue = item.issue;
          if (item.pages) metadata.pages = item.pages;
          if (item.DOI) metadata.DOI = item.DOI;
          if (item.ISBN) metadata.ISBN = item.ISBN;
          if (item.ISSN) metadata.ISSN = item.ISSN;
          if (item.edition) metadata.edition = item.edition;
          if (item.publisher) metadata.publisher = item.publisher;
          if (item.place) metadata.place = item.place;
          if (item.series) metadata.series = item.series;
          if (item.seriesNumber) metadata.seriesNumber = item.seriesNumber;
          if (item.numPages) metadata.numPages = item.numPages;
          if (item.creators && Array.isArray(item.creators) && item.creators.length > 0) {
            metadata.creators = item.creators.map((c) => ({
              firstName: c.firstName || "",
              lastName: c.lastName || "",
              creatorType: c.creatorType || "author"
            }));
          }
          if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
            metadata.tags = item.tags.map((t) => typeof t === "string" ? t : t.tag);
          }
          return metadata;
        }
        /**
         * 创建超时Promise
         * @param message 超时错误消息
         * @returns 超时Promise
         */
        createTimeout(message) {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(message)), this.timeout);
          });
        }
        /**
         * 释放资源
         */
        terminate() {
          if (this.pdfProcessor) {
            this.pdfProcessor.terminate();
          }
        }
      };
    }
  });

  // src/modules/itemCreator.ts
  var ItemCreator;
  var init_itemCreator = __esm({
    "src/modules/itemCreator.ts"() {
      "use strict";
      ItemCreator = class {
        /**
         * 从PDF创建新的Zotero条目
         * @param pdfPath PDF文件路径
         * @param collectionKey 可选的集合键
         * @param metadata 元数据（来自web服务或PDF属性）
         * @returns 创建的条目信息
         */
        async createItemFromPDF(pdfPath, collectionKey, metadata, pdfMetadata) {
          try {
            ztoolkit.log("[ItemCreator] \u521B\u5EFA\u6761\u76EE\u4ECEPDF:", { pdfPath, collectionKey });
            const itemType = metadata?.itemType || "document";
            const item = new Zotero.Item(itemType);
            item.libraryID = Zotero.Libraries.userLibraryID;
            const fieldsSet = [];
            const metadataSources = {
              webService: [],
              pdfProperties: [],
              manual: []
            };
            if (metadata) {
              this.setItemFields(item, metadata, fieldsSet, metadataSources.webService);
            }
            if (pdfMetadata) {
              this.setPDFFields(item, pdfMetadata, fieldsSet, metadataSources.pdfProperties);
            }
            if (!item.getField("title")) {
              const filename = pdfPath.split("/").pop()?.replace(".pdf", "") || "Untitled";
              item.setField("title", filename);
              fieldsSet.push("title");
              metadataSources.manual.push("title");
            }
            const itemID = await item.saveTx();
            ztoolkit.log("[ItemCreator] \u6761\u76EE\u5DF2\u521B\u5EFA:", { itemID, itemKey: item.key });
            let attachmentKey;
            try {
              const attachment = await Zotero.Attachments.importFromFile({
                file: pdfPath,
                parentItemID: itemID
              });
              attachmentKey = attachment.key;
              ztoolkit.log("[ItemCreator] PDF\u5DF2\u9644\u52A0:", { attachmentKey });
            } catch (error) {
              ztoolkit.log("[ItemCreator] PDF\u9644\u52A0\u5931\u8D25:", error, "error");
            }
            if (collectionKey) {
              try {
                const collection = Zotero.Collections.getByLibraryAndKey(
                  Zotero.Libraries.userLibraryID,
                  collectionKey
                );
                if (collection) {
                  await collection.addItem(itemID);
                  ztoolkit.log("[ItemCreator] \u5DF2\u6DFB\u52A0\u5230\u96C6\u5408:", { collectionKey });
                }
              } catch (error) {
                ztoolkit.log("[ItemCreator] \u6DFB\u52A0\u5230\u96C6\u5408\u5931\u8D25:", error, "error");
              }
            }
            return {
              itemKey: item.key,
              itemID,
              fieldsSet,
              attachmentKey,
              metadataSources
            };
          } catch (error) {
            ztoolkit.log("[ItemCreator] \u521B\u5EFA\u6761\u76EE\u5931\u8D25:", error, "error");
            throw error;
          }
        }
        /**
         * 更新现有条目的元数据
         * @param itemKey 条目键
         * @param metadata 要更新的元数据
         * @param overwriteExisting 是否覆盖现有字段
         * @returns 更新结果
         */
        async enrichExistingItem(itemKey, metadata, pdfMetadata, overwriteExisting = false) {
          try {
            ztoolkit.log("[ItemCreator] \u66F4\u65B0\u6761\u76EE:", { itemKey, overwriteExisting });
            const item = Zotero.Items.getByLibraryAndKey(
              Zotero.Libraries.userLibraryID,
              itemKey
            );
            if (!item) {
              throw new Error(`\u6761\u76EE\u672A\u627E\u5230: ${itemKey}`);
            }
            const fieldsUpdated = [];
            const fieldsSkipped = [];
            const tagsAdded = [];
            const metadataSources = {
              webService: [],
              pdfProperties: [],
              manual: []
            };
            if (metadata) {
              this.updateItemFields(
                item,
                metadata,
                overwriteExisting,
                fieldsUpdated,
                fieldsSkipped,
                metadataSources.webService
              );
            }
            if (pdfMetadata) {
              this.updatePDFFields(
                item,
                pdfMetadata,
                overwriteExisting,
                fieldsUpdated,
                fieldsSkipped,
                metadataSources.pdfProperties
              );
            }
            if (metadata?.tags && metadata.tags.length > 0) {
              const existingTags = item.getTags().map((t) => t.tag);
              for (const tag of metadata.tags) {
                if (!existingTags.includes(tag)) {
                  tagsAdded.push(tag);
                }
              }
              if (tagsAdded.length > 0) {
                const allTags = [...existingTags, ...tagsAdded];
                item.setTags(allTags.map((t) => ({ tag: t })));
              }
            }
            if (fieldsUpdated.length > 0 || tagsAdded.length > 0) {
              await item.saveTx();
              ztoolkit.log("[ItemCreator] \u6761\u76EE\u5DF2\u66F4\u65B0:", {
                fieldsUpdated,
                tagsAdded
              });
            } else {
              ztoolkit.log("[ItemCreator] \u65E0\u9700\u66F4\u65B0");
            }
            return {
              itemKey: item.key,
              fieldsUpdated,
              fieldsSkipped,
              tagsAdded,
              metadataSources
            };
          } catch (error) {
            ztoolkit.log("[ItemCreator] \u66F4\u65B0\u6761\u76EE\u5931\u8D25:", error, "error");
            throw error;
          }
        }
        /**
         * 设置条目字段（用于新条目）
         */
        setItemFields(item, metadata, fieldsSet, sourceList) {
          const fieldMap = [
            ["title", "title"],
            ["date", "date"],
            ["abstractNote", "abstractNote"],
            ["publicationTitle", "publicationTitle"],
            ["volume", "volume"],
            ["issue", "issue"],
            ["pages", "pages"],
            ["DOI", "DOI"],
            ["ISBN", "ISBN"],
            ["ISSN", "ISSN"],
            ["url", "url"],
            ["language", "language"],
            ["rights", "rights"],
            ["edition", "edition"],
            ["publisher", "publisher"],
            ["place", "place"],
            ["series", "series"],
            ["seriesNumber", "seriesNumber"],
            ["numPages", "numPages"]
          ];
          for (const [metaField, itemField] of fieldMap) {
            if (metadata[metaField]) {
              try {
                item.setField(itemField, String(metadata[metaField]));
                fieldsSet.push(itemField);
                sourceList.push(itemField);
              } catch (error) {
                ztoolkit.log(`[ItemCreator] \u8BBE\u7F6E\u5B57\u6BB5\u5931\u8D25 ${itemField}:`, error, "error");
              }
            }
          }
          if (metadata.creators && metadata.creators.length > 0) {
            try {
              item.setCreators(metadata.creators);
              fieldsSet.push("creators");
              sourceList.push("creators");
            } catch (error) {
              ztoolkit.log("[ItemCreator] \u8BBE\u7F6Ecreators\u5931\u8D25:", error, "error");
            }
          }
          if (metadata.tags && metadata.tags.length > 0) {
            try {
              item.setTags(metadata.tags.map((t) => ({ tag: t })));
              fieldsSet.push("tags");
              sourceList.push("tags");
            } catch (error) {
              ztoolkit.log("[ItemCreator] \u8BBE\u7F6Etags\u5931\u8D25:", error, "error");
            }
          }
        }
        /**
         * 从PDF属性设置字段
         */
        setPDFFields(item, pdfMetadata, fieldsSet, sourceList) {
          if (!item.getField("title") && pdfMetadata.title) {
            try {
              item.setField("title", pdfMetadata.title);
              fieldsSet.push("title");
              sourceList.push("title");
            } catch (error) {
              ztoolkit.log("[ItemCreator] \u8BBE\u7F6EPDF\u6807\u9898\u5931\u8D25:", error, "error");
            }
          }
          if (!item.getField("abstractNote") && pdfMetadata.subject) {
            try {
              item.setField("abstractNote", pdfMetadata.subject);
              fieldsSet.push("abstractNote");
              sourceList.push("abstractNote");
            } catch (error) {
              ztoolkit.log("[ItemCreator] \u8BBE\u7F6EPDF\u4E3B\u9898\u5931\u8D25:", error, "error");
            }
          }
          if (pdfMetadata.keywords && pdfMetadata.keywords.length > 0) {
            try {
              const existingTags = item.getTags();
              const newTags = [...existingTags, ...pdfMetadata.keywords.map((k) => ({ tag: k }))];
              item.setTags(newTags);
              fieldsSet.push("tags");
              sourceList.push("tags");
            } catch (error) {
              ztoolkit.log("[ItemCreator] \u8BBE\u7F6EPDF\u5173\u952E\u8BCD\u5931\u8D25:", error, "error");
            }
          }
        }
        /**
         * 更新条目字段（用于现有条目）
         */
        updateItemFields(item, metadata, overwriteExisting, fieldsUpdated, fieldsSkipped, sourceList) {
          const fieldMap = [
            ["title", "title"],
            ["date", "date"],
            ["abstractNote", "abstractNote"],
            ["publicationTitle", "publicationTitle"],
            ["volume", "volume"],
            ["issue", "issue"],
            ["pages", "pages"],
            ["DOI", "DOI"],
            ["ISBN", "ISBN"],
            ["ISSN", "ISSN"],
            ["url", "url"],
            ["language", "language"],
            ["rights", "rights"],
            ["edition", "edition"],
            ["publisher", "publisher"],
            ["place", "place"],
            ["series", "series"],
            ["seriesNumber", "seriesNumber"],
            ["numPages", "numPages"]
          ];
          for (const [metaField, itemField] of fieldMap) {
            if (metadata[metaField]) {
              try {
                const currentValue = item.getField(itemField);
                const isEmpty = !currentValue || currentValue.trim().length === 0;
                if (isEmpty || overwriteExisting) {
                  item.setField(itemField, String(metadata[metaField]));
                  fieldsUpdated.push(itemField);
                  sourceList.push(itemField);
                } else {
                  fieldsSkipped.push(itemField);
                }
              } catch (error) {
                ztoolkit.log(`[ItemCreator] \u66F4\u65B0\u5B57\u6BB5\u5931\u8D25 ${itemField}:`, error, "error");
              }
            }
          }
          if (metadata.creators && metadata.creators.length > 0) {
            try {
              const currentCreators = item.getCreators();
              if (currentCreators.length === 0 || overwriteExisting) {
                item.setCreators(metadata.creators);
                fieldsUpdated.push("creators");
                sourceList.push("creators");
              } else {
                fieldsSkipped.push("creators");
              }
            } catch (error) {
              ztoolkit.log("[ItemCreator] \u66F4\u65B0creators\u5931\u8D25:", error, "error");
            }
          }
        }
        /**
         * 从PDF属性更新字段
         */
        updatePDFFields(item, pdfMetadata, overwriteExisting, fieldsUpdated, fieldsSkipped, sourceList) {
          if (pdfMetadata.title) {
            try {
              const currentTitle = item.getField("title");
              if (!currentTitle || currentTitle.trim().length === 0 || overwriteExisting) {
                item.setField("title", pdfMetadata.title);
                fieldsUpdated.push("title");
                sourceList.push("title");
              } else {
                fieldsSkipped.push("title");
              }
            } catch (error) {
              ztoolkit.log("[ItemCreator] \u66F4\u65B0PDF\u6807\u9898\u5931\u8D25:", error, "error");
            }
          }
          if (pdfMetadata.subject) {
            try {
              const currentAbstract = item.getField("abstractNote");
              if (!currentAbstract || currentAbstract.trim().length === 0 || overwriteExisting) {
                item.setField("abstractNote", pdfMetadata.subject);
                fieldsUpdated.push("abstractNote");
                sourceList.push("abstractNote");
              } else {
                fieldsSkipped.push("abstractNote");
              }
            } catch (error) {
              ztoolkit.log("[ItemCreator] \u66F4\u65B0PDF\u4E3B\u9898\u5931\u8D25:", error, "error");
            }
          }
        }
      };
    }
  });

  // src/modules/streamableMCPServer.ts
  var streamableMCPServer_exports = {};
  __export(streamableMCPServer_exports, {
    StreamableMCPServer: () => StreamableMCPServer
  });
  function applyGlobalAIInstructions(responseData, toolName) {
    if (!responseData) {
      return createUnifiedResponse(null, "object", toolName);
    }
    if (typeof responseData === "string") {
      return createUnifiedResponse(responseData, "text", toolName);
    }
    if (Array.isArray(responseData)) {
      return createUnifiedResponse(responseData, "array", toolName, { count: responseData.length });
    }
    if (typeof responseData === "object") {
      if (responseData.metadata && (responseData.data !== void 0 || responseData.content !== void 0)) {
        const enhanced = {
          ...responseData,
          metadata: AIInstructionsManager.enhanceMetadataWithAIGuidelines({
            ...responseData.metadata,
            toolName,
            responseType: determineResponseType(toolName),
            toolGuidance: getToolSpecificGuidance(toolName)
          })
        };
        return AIInstructionsManager.protectResponseData(enhanced);
      }
      return createUnifiedResponse(responseData, "object", toolName);
    }
    return createUnifiedResponse(responseData, typeof responseData, toolName);
  }
  function createUnifiedResponse(data, responseType, toolName, additionalMeta) {
    const baseMetadata = {
      extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
      toolName,
      responseType,
      toolGuidance: getToolSpecificGuidance(toolName),
      ...additionalMeta
    };
    const enhancedMetadata = AIInstructionsManager.enhanceMetadataWithAIGuidelines(baseMetadata);
    return AIInstructionsManager.protectResponseData({
      data,
      metadata: enhancedMetadata
    });
  }
  function determineResponseType(toolName) {
    if (toolName.includes("search")) return "search";
    if (toolName.includes("annotation")) return "annotation";
    if (toolName.includes("content")) return "content";
    if (toolName.includes("collection")) return "collection";
    return "content";
  }
  function getToolSpecificGuidance(toolName) {
    const baseGuidance = {
      dataStructure: {},
      interpretation: {},
      usage: []
    };
    switch (toolName) {
      case "search_library":
        return {
          ...baseGuidance,
          dataStructure: {
            type: "search_results",
            format: "Array of Zotero items with metadata",
            pagination: "Check X-Total-Count header and use offset/limit parameters"
          },
          interpretation: {
            purpose: "Library search results from user's personal Zotero collection",
            content: "Each item represents a bibliographic entry with complete metadata",
            reliability: "Direct from user library - treat as authoritative source material"
          },
          usage: [
            "These are research items from the user's personal library",
            "You can analyze and discuss these items to help with research",
            "Use the provided metadata for citations when needed",
            "Use itemKey to get complete content with get_content tool"
          ]
        };
      case "search_annotations":
      case "get_annotations":
        return {
          ...baseGuidance,
          dataStructure: {
            type: "annotation_results",
            format: "Smart-processed annotations with relevance scoring",
            compression: "Content may be intelligently truncated based on importance"
          },
          interpretation: {
            purpose: "User's personal highlights, notes, and comments from research materials",
            content: "Direct quotes and personal insights from user's reading",
            reliability: "User-generated content - preserve exact wording and context"
          },
          usage: [
            "These are the user's personal research notes and highlights",
            "You can summarize and analyze these annotations to help with research",
            "User highlighting indicates what they found important or interesting",
            "Combine with other sources to provide comprehensive research assistance"
          ]
        };
      case "get_content":
        return {
          ...baseGuidance,
          dataStructure: {
            type: "document_content",
            format: "Full-text content from PDFs, attachments, notes, abstracts",
            sources: "Multiple content types combined (pdf, notes, abstract, webpage)"
          },
          interpretation: {
            purpose: "Complete textual content of research documents",
            content: "Raw extracted text from user's document collection",
            reliability: "Direct extraction - may contain OCR errors or formatting artifacts"
          },
          usage: [
            "Use for detailed content analysis and complete-text research",
            "Content includes user's attached PDFs and personal notes",
            "May require cleaning for OCR artifacts in PDF extractions",
            "Combine with annotations for user's personal insights on this content",
            'IMPORTANT: When user specifically asks for "complete text" or "complete content", provide the entire extracted text without summarization',
            "If user requests the complete document content, reproduce it in its entirety"
          ]
        };
      case "get_collections":
      case "search_collections":
      case "get_collection_details":
      case "get_collection_items":
      case "get_subcollections":
        return {
          ...baseGuidance,
          dataStructure: {
            type: "collection_data",
            format: "Hierarchical collection structure with items and subcollections",
            organization: "Reflects user's personal research organization system"
          },
          interpretation: {
            purpose: "User's personal organization system for research materials",
            content: "Custom-named folders reflecting research topics and projects",
            reliability: "User-curated organization - reflects research priorities"
          },
          usage: [
            "Collection names indicate user's research areas and interests",
            "Use collection structure to understand research project organization",
            "Respect user's categorization decisions in your responses",
            "Collections show thematic relationships between documents"
          ]
        };
      case "search_fulltext":
        return {
          ...baseGuidance,
          dataStructure: {
            type: "fulltext_search",
            format: "Full-text search results with content snippets",
            relevance: "Results ranked by text matching and relevance"
          },
          interpretation: {
            purpose: "Deep content search across all document texts",
            content: "Matching text passages from user's entire document collection",
            reliability: "Search-based - results depend on query accuracy"
          },
          usage: [
            "Use for finding specific concepts across entire research collection",
            "Results show where user has relevant materials on specific topics",
            "Combine with other tools for complete context",
            "Good for discovering connections between different documents",
            "When user asks for complete content from search results, use get_content with the itemKey to retrieve complete text"
          ]
        };
      case "get_item_details":
        return {
          ...baseGuidance,
          dataStructure: {
            type: "item_metadata",
            format: "Complete bibliographic metadata for single item",
            completeness: "Full citation information and item relationships"
          },
          interpretation: {
            purpose: "Detailed metadata for specific research item",
            content: "Publication details, authors, dates, identifiers, relationships",
            reliability: "Curated metadata - suitable for citations and references"
          },
          usage: [
            "Use for generating proper citations and references",
            "Contains all bibliographic data needed for academic writing",
            "Use itemKey to access complete content via get_content",
            "Check for related items and collections for broader context"
          ]
        };
      case "get_item_abstract":
        return {
          ...baseGuidance,
          dataStructure: {
            type: "abstract_content",
            format: "Academic abstract or summary text",
            source: "Publisher-provided or user-entered abstract"
          },
          interpretation: {
            purpose: "Summary of research paper or document main points",
            content: "Concise overview of research objectives, methods, results",
            reliability: "Authoritative summary - typically from original publication"
          },
          usage: [
            "Use for quick understanding of paper's main contributions",
            "Suitable for literature reviews and research summaries",
            "Abstract represents author's own summary of their work",
            "Combine with complete content and annotations for complete understanding"
          ]
        };
      default:
        return baseGuidance;
    }
  }
  var StreamableMCPServer;
  var init_streamableMCPServer = __esm({
    "src/modules/streamableMCPServer.ts"() {
      "use strict";
      init_apiHandlers();
      init_unifiedContentExtractor();
      init_smartAnnotationExtractor();
      init_mcpSettingsService();
      init_aiInstructionsManager();
      init_citationFormatter();
      init_pdfMetadataExtractor();
      init_zoteroMetadataRetriever();
      init_itemCreator();
      StreamableMCPServer = class {
        isInitialized = false;
        serverInfo = {
          name: "zotero-integrated-mcp",
          version: "1.1.0"
        };
        clientSessions = /* @__PURE__ */ new Map();
        constructor() {
        }
        /**
         * Handle incoming MCP requests and return HTTP response
         */
        async handleMCPRequest(requestBody) {
          try {
            const request = JSON.parse(requestBody);
            ztoolkit.log(`[StreamableMCP] Received: ${request.method}`);
            const response = await this.processRequest(request);
            return {
              status: 200,
              statusText: "OK",
              headers: { "Content-Type": "application/json; charset=utf-8" },
              body: JSON.stringify(response)
            };
          } catch (error) {
            ztoolkit.log(`[StreamableMCP] Error handling request: ${error}`);
            const errorResponse = {
              jsonrpc: "2.0",
              id: "unknown",
              error: {
                code: -32700,
                message: "Parse error"
              }
            };
            return {
              status: 400,
              statusText: "Bad Request",
              headers: { "Content-Type": "application/json; charset=utf-8" },
              body: JSON.stringify(errorResponse)
            };
          }
        }
        /**
         * Process individual MCP requests
         */
        async processRequest(request) {
          try {
            switch (request.method) {
              case "initialize":
                return this.handleInitialize(request);
              case "initialized":
                this.isInitialized = true;
                ztoolkit.log("[StreamableMCP] Client initialized");
                return this.createResponse(request.id, { success: true });
              case "tools/list":
                return this.handleToolsList(request);
              case "tools/call":
                return await this.handleToolCall(request);
              case "resources/list":
                return this.handleResourcesList(request);
              case "prompts/list":
                return this.handlePromptsList(request);
              case "ping":
                return this.handlePing(request);
              default:
                return this.createError(request.id, -32601, `Method not found: ${request.method}`);
            }
          } catch (error) {
            ztoolkit.log(`[StreamableMCP] Error processing ${request.method}: ${error}`);
            return this.createError(request.id, -32603, "Internal error");
          }
        }
        handleInitialize(request) {
          const clientInfo = request.params?.clientInfo || {};
          const sessionId = this.generateSessionId();
          this.clientSessions.set(sessionId, {
            initTime: /* @__PURE__ */ new Date(),
            lastActivity: /* @__PURE__ */ new Date(),
            clientInfo
          });
          ztoolkit.log(`[StreamableMCP] Client initialized with session: ${sessionId}, client: ${clientInfo.name || "unknown"}`);
          return this.createResponse(request.id, {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {
                listChanged: true
              },
              logging: {},
              prompts: {},
              resources: {}
            },
            serverInfo: this.serverInfo
          });
        }
        generateSessionId() {
          return "mcp-session-" + Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 9);
        }
        handleResourcesList(request) {
          return this.createResponse(request.id, { resources: [] });
        }
        handlePromptsList(request) {
          return this.createResponse(request.id, { prompts: [] });
        }
        handlePing(request) {
          return this.createResponse(request.id, {});
        }
        handleToolsList(request) {
          const tools = [
            {
              name: "search_library",
              description: "Search the Zotero library with advanced parameters, boolean operators, relevance scoring, pagination, and intelligent mode control.",
              inputSchema: {
                type: "object",
                properties: {
                  q: { type: "string", description: "General search query" },
                  title: { type: "string", description: "Title search" },
                  titleOperator: {
                    type: "string",
                    enum: ["contains", "exact", "startsWith", "endsWith", "regex"],
                    description: "Title search operator"
                  },
                  yearRange: { type: "string", description: 'Year range (e.g., "2020-2023")' },
                  fulltext: { type: "string", description: "Full-text search in attachments and notes" },
                  fulltextMode: {
                    type: "string",
                    enum: ["attachment", "note", "both"],
                    description: "Full-text search mode: attachment (PDFs only), note (notes only), both (default)"
                  },
                  fulltextOperator: {
                    type: "string",
                    enum: ["contains", "exact", "regex"],
                    description: "Full-text search operator (default: contains)"
                  },
                  mode: {
                    type: "string",
                    enum: ["minimal", "preview", "standard", "complete"],
                    description: "Processing mode: minimal (30 results), preview (100), standard (adaptive), complete (500+). Uses user default if not specified."
                  },
                  relevanceScoring: { type: "boolean", description: "Enable relevance scoring" },
                  sort: {
                    type: "string",
                    enum: ["relevance", "date", "title", "year"],
                    description: "Sort order"
                  },
                  limit: { type: "number", description: "Maximum results to return (overrides mode default)" },
                  offset: { type: "number", description: "Pagination offset" }
                }
              }
            },
            {
              name: "search_annotations",
              description: "Search annotations and notes with intelligent ranking and content management",
              inputSchema: {
                type: "object",
                properties: {
                  q: { type: "string", description: "Search query" },
                  itemKeys: {
                    type: "array",
                    items: { type: "string" },
                    description: "Limit search to specific items"
                  },
                  types: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["note", "highlight", "annotation", "ink", "text", "image"]
                    },
                    description: "Types of annotations to search"
                  },
                  mode: {
                    type: "string",
                    enum: ["standard", "preview", "complete", "minimal"],
                    description: "Content processing mode (uses user setting default if not specified)"
                  },
                  maxTokens: {
                    type: "number",
                    description: "Token budget (uses user setting default if not specified)"
                  },
                  minRelevance: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    default: 0.1,
                    description: "Minimum relevance threshold"
                  },
                  limit: { type: "number", default: 15, description: "Maximum results" },
                  offset: { type: "number", default: 0, description: "Pagination offset" }
                },
                required: ["q"]
              }
            },
            {
              name: "get_item_details",
              description: "Get detailed information for a specific item with intelligent mode control (metadata, abstract, attachments, notes, tags but not fulltext content)",
              inputSchema: {
                type: "object",
                properties: {
                  itemKey: { type: "string", description: "Unique item key" },
                  mode: {
                    type: "string",
                    enum: ["minimal", "preview", "standard", "complete"],
                    description: "Processing mode: minimal (basic info), preview (key fields), standard (comprehensive), complete (all fields). Uses user default if not specified."
                  }
                },
                required: ["itemKey"]
              }
            },
            {
              name: "get_annotations",
              description: "Get annotations and notes with intelligent content management (PDF annotations, highlights, notes)",
              inputSchema: {
                type: "object",
                properties: {
                  itemKey: { type: "string", description: "Get all annotations for this item" },
                  annotationId: { type: "string", description: "Get specific annotation by ID" },
                  annotationIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Get multiple annotations by IDs"
                  },
                  types: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["note", "highlight", "annotation", "ink", "text", "image"]
                    },
                    default: ["note", "highlight", "annotation"],
                    description: "Types of annotations to include"
                  },
                  mode: {
                    type: "string",
                    enum: ["standard", "preview", "complete", "minimal"],
                    description: "Content processing mode (uses user setting default if not specified)"
                  },
                  maxTokens: {
                    type: "number",
                    description: "Token budget (uses user setting default if not specified)"
                  },
                  limit: { type: "number", default: 20, description: "Maximum results" },
                  offset: { type: "number", default: 0, description: "Pagination offset" }
                },
                description: "Requires either itemKey, annotationId, or annotationIds parameter"
              }
            },
            {
              name: "get_content",
              description: "Unified content extraction tool: get PDF, attachments, notes, abstract etc. from items or specific attachments with intelligent processing",
              inputSchema: {
                type: "object",
                properties: {
                  itemKey: { type: "string", description: "Item key to get all content from this item" },
                  attachmentKey: { type: "string", description: "Attachment key to get content from specific attachment" },
                  mode: {
                    type: "string",
                    enum: ["minimal", "preview", "standard", "complete"],
                    description: "Content processing mode: minimal (500 chars, fastest), preview (1.5K chars, quick scan), standard (3K chars, balanced), complete (unlimited, complete content). Uses user default if not specified."
                  },
                  include: {
                    type: "object",
                    properties: {
                      pdf: { type: "boolean", default: true, description: "Include PDF attachments content" },
                      attachments: { type: "boolean", default: true, description: "Include other attachments content" },
                      notes: { type: "boolean", default: true, description: "Include notes content" },
                      abstract: { type: "boolean", default: true, description: "Include abstract" },
                      webpage: { type: "boolean", default: false, description: "Include webpage snapshots (auto-enabled in standard/complete modes)" }
                    },
                    description: "Content types to include (only applies to itemKey)"
                  },
                  contentControl: {
                    type: "object",
                    properties: {
                      preserveOriginal: { type: "boolean", default: true, description: "Always preserve original text structure when processing" },
                      allowExtended: { type: "boolean", default: false, description: "Allow retrieving more content than mode default when important" },
                      expandIfImportant: { type: "boolean", default: false, description: "Expand content length for high-importance content" },
                      maxContentLength: { type: "number", description: "Override maximum content length for this request" },
                      prioritizeCompleteness: { type: "boolean", default: false, description: "Prioritize complete sentences/paragraphs over strict length limits" },
                      standardExpansion: {
                        type: "object",
                        properties: {
                          enabled: { type: "boolean", default: false, description: "Enable standard content expansion" },
                          trigger: {
                            type: "string",
                            enum: ["high_importance", "user_query", "context_needed"],
                            default: "high_importance",
                            description: "Trigger condition for standard expansion"
                          },
                          maxExpansionRatio: { type: "number", default: 2, minimum: 1, maximum: 10, description: "Maximum expansion ratio (1.0 = no expansion, 2.0 = double)" }
                        },
                        description: "Smart expansion configuration"
                      }
                    },
                    description: "Advanced content control parameters to override mode defaults"
                  },
                  format: {
                    type: "string",
                    enum: ["json", "text"],
                    default: "json",
                    description: "Output format: json (structured with metadata) or text (plain text)"
                  }
                },
                description: "Requires either itemKey or attachmentKey parameter"
              }
            },
            {
              name: "get_collections",
              description: "Get list of all collections in the library with intelligent mode control",
              inputSchema: {
                type: "object",
                properties: {
                  mode: {
                    type: "string",
                    enum: ["minimal", "preview", "standard", "complete"],
                    description: "Processing mode: minimal (20 collections), preview (50), standard (100), complete (500+). Uses user default if not specified."
                  },
                  limit: { type: "number", description: "Maximum results to return (overrides mode default)" },
                  offset: { type: "number", description: "Pagination offset" }
                }
              }
            },
            {
              name: "search_collections",
              description: "Search collections by name",
              inputSchema: {
                type: "object",
                properties: {
                  q: { type: "string", description: "Collection name search query" },
                  limit: { type: "number", description: "Maximum results to return" }
                }
              }
            },
            {
              name: "get_collection_details",
              description: "Get detailed information about a specific collection",
              inputSchema: {
                type: "object",
                properties: {
                  collectionKey: { type: "string", description: "Collection key" }
                },
                required: ["collectionKey"]
              }
            },
            {
              name: "get_collection_items",
              description: "Get items in a specific collection",
              inputSchema: {
                type: "object",
                properties: {
                  collectionKey: { type: "string", description: "Collection key" },
                  limit: { type: "number", description: "Maximum results to return" },
                  offset: { type: "number", description: "Pagination offset" }
                },
                required: ["collectionKey"]
              }
            },
            {
              name: "get_subcollections",
              description: "Get subcollections (child collections) of a specific collection",
              inputSchema: {
                type: "object",
                properties: {
                  collectionKey: { type: "string", description: "Parent collection key" },
                  limit: { type: "number", description: "Maximum results to return (default: 100)" },
                  offset: { type: "number", description: "Pagination offset (default: 0)" },
                  recursive: {
                    type: "boolean",
                    description: "Include subcollection count for each subcollection (default: false)"
                  }
                },
                required: ["collectionKey"]
              }
            },
            {
              name: "search_fulltext",
              description: "Search within fulltext content of items with context, relevance scoring, and intelligent mode control",
              inputSchema: {
                type: "object",
                properties: {
                  q: { type: "string", description: "Search query" },
                  itemKeys: {
                    type: "array",
                    items: { type: "string" },
                    description: "Limit search to specific items (optional)"
                  },
                  mode: {
                    type: "string",
                    enum: ["minimal", "preview", "standard", "complete"],
                    description: "Processing mode: minimal (100 context), preview (200), standard (adaptive), complete (400+). Uses user default if not specified."
                  },
                  contextLength: { type: "number", description: "Context length around matches (overrides mode default)" },
                  maxResults: { type: "number", description: "Maximum results to return (overrides mode default)" },
                  caseSensitive: { type: "boolean", description: "Case sensitive search (default: false)" }
                },
                required: ["q"]
              }
            },
            {
              name: "get_item_abstract",
              description: "Get the abstract/summary of a specific item",
              inputSchema: {
                type: "object",
                properties: {
                  itemKey: { type: "string", description: "Item key" },
                  format: {
                    type: "string",
                    enum: ["json", "text"],
                    description: "Response format (default: json)"
                  }
                },
                required: ["itemKey"]
              }
            },
            {
              name: "get_item_citation",
              description: "Generate a citation for a specific item in various CSL styles (APA, Chicago, Harvard, IEEE, MLA, Nature, Vancouver, BibTeX)",
              inputSchema: {
                type: "object",
                properties: {
                  itemKey: { type: "string", description: "Item key (required)" },
                  style: {
                    type: "string",
                    enum: ["apa", "chicago-author-date", "harvard1", "ieee", "mla", "nature", "vancouver", "bibtex"],
                    description: "Citation style (default: apa)"
                  },
                  format: {
                    type: "string",
                    enum: ["html", "text", "bibtex"],
                    description: "Output format: html (with formatting), text (plain text), bibtex (BibTeX entry)"
                  },
                  itemKeys: {
                    type: "array",
                    items: { type: "string" },
                    description: "Multiple item keys to generate citations for (batch mode)"
                  }
                },
                required: ["itemKey"]
              }
            },
            {
              name: "upload_pdf_and_create_item",
              description: "Upload a PDF file, extract metadata using Zotero web service and PDF properties, and create a new Zotero item with the PDF attached",
              inputSchema: {
                type: "object",
                properties: {
                  pdfPath: {
                    type: "string",
                    description: "Absolute path to the PDF file to upload"
                  },
                  collectionKey: {
                    type: "string",
                    description: "Optional collection key to add the item to"
                  },
                  itemType: {
                    type: "string",
                    description: "Optional item type override (default: auto-detect from metadata)"
                  },
                  useWebService: {
                    type: "boolean",
                    default: true,
                    description: "Use Zotero web service to retrieve metadata (default: true)"
                  },
                  extractPDFProperties: {
                    type: "boolean",
                    default: true,
                    description: "Extract metadata from PDF document properties (default: true)"
                  }
                },
                required: ["pdfPath"]
              }
            },
            {
              name: "enrich_item_from_pdf",
              description: "Enrich an existing Zotero item by extracting metadata from its PDF attachment using Zotero web service and PDF properties",
              inputSchema: {
                type: "object",
                properties: {
                  itemKey: {
                    type: "string",
                    description: "Item key to enrich"
                  },
                  attachmentKey: {
                    type: "string",
                    description: "Specific PDF attachment key (default: use first PDF attachment)"
                  },
                  overwriteExisting: {
                    type: "boolean",
                    default: false,
                    description: "Overwrite existing field values (default: false, only fill empty fields)"
                  },
                  useWebService: {
                    type: "boolean",
                    default: true,
                    description: "Use Zotero web service to retrieve metadata (default: true)"
                  },
                  extractPDFProperties: {
                    type: "boolean",
                    default: true,
                    description: "Extract metadata from PDF document properties (default: true)"
                  },
                  fieldsToUpdate: {
                    type: "array",
                    items: { type: "string" },
                    description: "Limit updates to specific fields (default: all fields)"
                  }
                },
                required: ["itemKey"]
              }
            }
          ];
          return this.createResponse(request.id, { tools });
        }
        async handleToolCall(request) {
          const { name, arguments: args } = request.params;
          try {
            let result;
            switch (name) {
              case "search_library":
                result = await this.callSearchLibrary(args);
                break;
              case "search_annotations":
                if (!args?.q) {
                  throw new Error("q (query) is required");
                }
                result = await this.callSearchAnnotations(args);
                break;
              case "get_item_details":
                if (!args?.itemKey) {
                  throw new Error("itemKey is required");
                }
                result = await this.callGetItemDetails(args);
                break;
              case "get_annotations":
                if (!args?.itemKey && !args?.annotationId && !args?.annotationIds) {
                  throw new Error("Either itemKey, annotationId, or annotationIds is required");
                }
                result = await this.callGetAnnotations(args);
                break;
              case "get_content":
                if (!args?.itemKey && !args?.attachmentKey) {
                  throw new Error("Either itemKey or attachmentKey is required");
                }
                result = await this.callGetContent(args);
                break;
              case "get_collections":
                result = await this.callGetCollections(args);
                break;
              case "search_collections":
                result = await this.callSearchCollections(args);
                break;
              case "get_collection_details":
                if (!args?.collectionKey) {
                  throw new Error("collectionKey is required");
                }
                result = await this.callGetCollectionDetails(args.collectionKey);
                break;
              case "get_collection_items":
                if (!args?.collectionKey) {
                  throw new Error("collectionKey is required");
                }
                result = await this.callGetCollectionItems(args);
                break;
              case "get_subcollections":
                if (!args?.collectionKey) {
                  throw new Error("collectionKey is required");
                }
                result = await this.callGetSubcollections(args);
                break;
              case "search_fulltext":
                if (!args?.q) {
                  throw new Error("q (query) is required");
                }
                result = await this.callSearchFulltext(args);
                break;
              case "get_item_abstract":
                if (!args?.itemKey) {
                  throw new Error("itemKey is required");
                }
                result = await this.callGetItemAbstract(args);
                break;
              case "get_item_citation":
                if (!args?.itemKey) {
                  throw new Error("itemKey is required");
                }
                result = await this.callGetItemCitation(args);
                break;
              case "upload_pdf_and_create_item":
                if (!args?.pdfPath) {
                  throw new Error("pdfPath is required");
                }
                result = await this.callUploadPdfAndCreateItem(args);
                break;
              case "enrich_item_from_pdf":
                if (!args?.itemKey) {
                  throw new Error("itemKey is required");
                }
                result = await this.callEnrichItemFromPdf(args);
                break;
              default:
                throw new Error(`Unknown tool: ${name}`);
            }
            return this.createResponse(request.id, {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2)
                }
              ]
            });
          } catch (error) {
            ztoolkit.log(`[StreamableMCP] Tool call error for ${name}: ${error}`);
            return this.createError(
              request.id,
              -32603,
              `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
        async callSearchLibrary(args) {
          const effectiveMode = args.mode || MCPSettingsService.get("content.mode");
          const modeConfig = this.getSearchModeConfiguration(effectiveMode);
          const processedArgs = {
            ...args,
            limit: args.limit || modeConfig.limit
          };
          const searchParams = new URLSearchParams();
          for (const [key, value] of Object.entries(processedArgs)) {
            if (value !== void 0 && value !== null) {
              if (key !== "mode") {
                searchParams.append(key, String(value));
              }
            }
          }
          const response = await handleSearch(searchParams);
          let result = response.body ? JSON.parse(response.body) : response;
          if (result && typeof result === "object") {
            result.metadata = {
              ...result.metadata,
              mode: effectiveMode,
              appliedModeConfig: modeConfig
            };
            if (Array.isArray(result.content) && result.content.length === 0) {
              delete result.content;
            }
          }
          return applyGlobalAIInstructions(result, "search_library");
        }
        async callSearchAnnotations(args) {
          const extractor = new SmartAnnotationExtractor();
          const { q, ...options } = args;
          const result = await extractor.searchAnnotations(q, options);
          return applyGlobalAIInstructions(result, "search_annotations");
        }
        async callGetItemDetails(args) {
          const { itemKey, mode } = args;
          const { handleGetItem: handleGetItem3 } = await Promise.resolve().then(() => (init_apiHandlers(), apiHandlers_exports));
          const effectiveMode = mode || MCPSettingsService.get("content.mode");
          const queryParams = new URLSearchParams();
          if (effectiveMode !== "complete") {
            const modeConfig = this.getItemDetailsModeConfiguration(effectiveMode);
            if (modeConfig.fields) {
              queryParams.append("fields", modeConfig.fields.join(","));
            }
          }
          const response = await handleGetItem3({ 1: itemKey }, queryParams);
          let result = response.body ? JSON.parse(response.body) : response;
          if (result && typeof result === "object") {
            result.metadata = {
              ...result.metadata,
              mode: effectiveMode,
              appliedModeConfig: this.getItemDetailsModeConfiguration(effectiveMode)
            };
          }
          return applyGlobalAIInstructions(result, "get_item_details");
        }
        async callGetAnnotations(args) {
          const extractor = new SmartAnnotationExtractor();
          const result = await extractor.getAnnotations(args);
          return applyGlobalAIInstructions(result, "get_annotations");
        }
        async callGetContent(args) {
          const { itemKey, attachmentKey, include, format, mode, contentControl } = args;
          const extractor = new UnifiedContentExtractor();
          try {
            let result;
            if (itemKey) {
              result = await extractor.getItemContent(itemKey, include || {}, mode, contentControl);
            } else if (attachmentKey) {
              result = await extractor.getAttachmentContent(attachmentKey, mode, contentControl);
            } else {
              throw new Error("Either itemKey or attachmentKey must be provided");
            }
            if (format === "text" && itemKey) {
              return extractor.convertToText(result);
            } else if (format === "text" && attachmentKey) {
              return result.content || "";
            }
            return applyGlobalAIInstructions(result, "get_content");
          } catch (error) {
            ztoolkit.log(`[StreamableMCP] Error in callGetContent: ${error}`, "error");
            throw error;
          }
        }
        async callGetCollections(args) {
          const effectiveMode = args.mode || MCPSettingsService.get("content.mode");
          const modeConfig = this.getCollectionModeConfiguration(effectiveMode);
          const processedArgs = {
            ...args,
            limit: args.limit || modeConfig.limit
          };
          const collectionParams = new URLSearchParams();
          for (const [key, value] of Object.entries(processedArgs)) {
            if (value !== void 0 && value !== null) {
              if (key !== "mode") {
                collectionParams.append(key, String(value));
              }
            }
          }
          const response = await handleGetCollections(collectionParams);
          let result = response.body ? JSON.parse(response.body) : response;
          if (result && typeof result === "object") {
            result.metadata = {
              ...result.metadata,
              mode: effectiveMode,
              appliedModeConfig: modeConfig
            };
          }
          return applyGlobalAIInstructions(result, "get_collections");
        }
        async callSearchCollections(args) {
          const searchParams = new URLSearchParams();
          for (const [key, value] of Object.entries(args || {})) {
            if (value !== void 0 && value !== null) {
              searchParams.append(key, String(value));
            }
          }
          const response = await handleSearchCollections(searchParams);
          const result = response.body ? JSON.parse(response.body) : response;
          return applyGlobalAIInstructions(result, "search_collections");
        }
        async callGetCollectionDetails(collectionKey) {
          const response = await handleGetCollectionDetails({ 1: collectionKey }, new URLSearchParams());
          const result = response.body ? JSON.parse(response.body) : response;
          return applyGlobalAIInstructions(result, "get_collection_details");
        }
        async callGetCollectionItems(args) {
          const { collectionKey, ...otherArgs } = args;
          const itemParams = new URLSearchParams();
          for (const [key, value] of Object.entries(otherArgs)) {
            if (value !== void 0 && value !== null) {
              itemParams.append(key, String(value));
            }
          }
          const response = await handleGetCollectionItems({ 1: collectionKey }, itemParams);
          const result = response.body ? JSON.parse(response.body) : response;
          return applyGlobalAIInstructions(result, "get_collection_items");
        }
        async callGetSubcollections(args) {
          const { collectionKey, ...otherArgs } = args;
          const subcollectionParams = new URLSearchParams();
          for (const [key, value] of Object.entries(otherArgs)) {
            if (value !== void 0 && value !== null) {
              subcollectionParams.append(key, String(value));
            }
          }
          const response = await handleGetSubcollections({ 1: collectionKey }, subcollectionParams);
          const result = response.body ? JSON.parse(response.body) : response;
          return applyGlobalAIInstructions(result, "get_subcollections");
        }
        async callSearchFulltext(args) {
          const effectiveMode = args.mode || MCPSettingsService.get("content.mode");
          const modeConfig = this.getFulltextModeConfiguration(effectiveMode);
          const processedArgs = {
            ...args,
            contextLength: args.contextLength || modeConfig.contextLength,
            maxResults: args.maxResults || modeConfig.maxResults
          };
          const searchParams = new URLSearchParams();
          for (const [key, value] of Object.entries(processedArgs)) {
            if (value !== void 0 && value !== null) {
              if (key === "itemKeys" && Array.isArray(value)) {
                searchParams.append(key, value.join(","));
              } else if (key !== "mode") {
                searchParams.append(key, String(value));
              }
            }
          }
          const response = await handleSearchFulltext(searchParams);
          let result = response.body ? JSON.parse(response.body) : response;
          if (result && typeof result === "object") {
            result.metadata = {
              ...result.metadata,
              mode: effectiveMode,
              appliedModeConfig: modeConfig
            };
          }
          return applyGlobalAIInstructions(result, "search_fulltext");
        }
        async callGetItemAbstract(args) {
          const { itemKey, ...otherArgs } = args;
          const abstractParams = new URLSearchParams();
          for (const [key, value] of Object.entries(otherArgs)) {
            if (value !== void 0 && value !== null) {
              abstractParams.append(key, String(value));
            }
          }
          const response = await handleGetItemAbstract({ 1: itemKey }, abstractParams);
          const result = response.body ? JSON.parse(response.body) : response;
          return applyGlobalAIInstructions(result, "get_item_abstract");
        }
        async callGetItemCitation(args) {
          const { itemKey, style: style2, format, itemKeys } = args;
          if (itemKeys && Array.isArray(itemKeys) && itemKeys.length > 0) {
            const items = [];
            for (const key of itemKeys) {
              const item2 = Zotero.Items.getByLibraryAndKey(
                Zotero.Libraries.userLibraryID,
                key
              );
              if (item2) {
                items.push(item2);
              }
            }
            const effectiveStyle2 = style2 || getDefaultStyle();
            const effectiveFormat2 = format === "bibtex" ? "bibtex" : format === "html" ? "html" : "text";
            const result2 = await generateMultipleCitations(items, effectiveStyle2, effectiveFormat2);
            return applyGlobalAIInstructions(result2, "get_item_citation");
          }
          const item = Zotero.Items.getByLibraryAndKey(
            Zotero.Libraries.userLibraryID,
            itemKey
          );
          if (!item) {
            throw new Error(`Item with key ${itemKey} not found`);
          }
          const effectiveStyle = style2 || getDefaultStyle();
          const effectiveFormat = format === "bibtex" ? "bibtex" : format === "html" ? "html" : "text";
          const result = await generateCitation(item, effectiveStyle, effectiveFormat);
          return applyGlobalAIInstructions(result, "get_item_citation");
        }
        async callUploadPdfAndCreateItem(args) {
          const {
            pdfPath,
            collectionKey,
            itemType,
            useWebService = true,
            extractPDFProperties = true
          } = args;
          try {
            ztoolkit.log("[StreamableMCP] upload_pdf_and_create_item:", { pdfPath, collectionKey });
            let webMetadata = null;
            let pdfMetadata = null;
            if (useWebService) {
              const retriever = new ZoteroMetadataRetriever(ztoolkit);
              try {
                webMetadata = await retriever.retrieveFromPDF(pdfPath);
                ztoolkit.log("[StreamableMCP] Web metadata retrieved:", webMetadata);
              } catch (error) {
                ztoolkit.log("[StreamableMCP] Web metadata retrieval failed:", error, "error");
              } finally {
                retriever.terminate();
              }
            }
            if (extractPDFProperties) {
              const extractor = new PDFMetadataExtractor(ztoolkit);
              try {
                pdfMetadata = await extractor.extractMetadata(pdfPath);
                ztoolkit.log("[StreamableMCP] PDF metadata extracted:", pdfMetadata);
              } catch (error) {
                ztoolkit.log("[StreamableMCP] PDF metadata extraction failed:", error, "error");
              } finally {
                extractor.terminate();
              }
            }
            if (itemType && webMetadata) {
              webMetadata.itemType = itemType;
            }
            const creator = new ItemCreator();
            const result = await creator.createItemFromPDF(
              pdfPath,
              collectionKey,
              webMetadata || void 0,
              pdfMetadata || void 0
            );
            const item = Zotero.Items.getByLibraryAndKey(
              Zotero.Libraries.userLibraryID,
              result.itemKey
            );
            const responseData = {
              success: true,
              item: {
                key: result.itemKey,
                id: result.itemID,
                title: item.getField("title"),
                creators: item.getCreators().map(
                  (c) => `${c.firstName || ""} ${c.lastName || ""}`.trim()
                ).join(", "),
                itemType: item.itemType,
                date: item.getField("date"),
                DOI: item.getField("DOI") || void 0
              },
              attachment: result.attachmentKey ? {
                key: result.attachmentKey,
                filename: pdfPath.split("/").pop()
              } : void 0,
              fieldsSet: result.fieldsSet,
              metadataSources: result.metadataSources
            };
            return applyGlobalAIInstructions(responseData, "upload_pdf_and_create_item");
          } catch (error) {
            ztoolkit.log("[StreamableMCP] upload_pdf_and_create_item failed:", error, "error");
            throw error;
          }
        }
        async callEnrichItemFromPdf(args) {
          const {
            itemKey,
            attachmentKey,
            overwriteExisting = false,
            useWebService = true,
            extractPDFProperties = true,
            fieldsToUpdate
          } = args;
          try {
            ztoolkit.log("[StreamableMCP] enrich_item_from_pdf:", { itemKey, attachmentKey });
            const item = Zotero.Items.getByLibraryAndKey(
              Zotero.Libraries.userLibraryID,
              itemKey
            );
            if (!item) {
              throw new Error(`Item with key ${itemKey} not found`);
            }
            let pdfPath = null;
            if (attachmentKey) {
              const attachment = Zotero.Items.getByLibraryAndKey(
                Zotero.Libraries.userLibraryID,
                attachmentKey
              );
              if (attachment && attachment.isPDFAttachment()) {
                pdfPath = attachment.getFilePath();
              }
            } else {
              const attachmentIds = item.getAttachments();
              const attachments = Zotero.Items.get(attachmentIds);
              for (const attachment of attachments) {
                if (attachment.isPDFAttachment()) {
                  pdfPath = attachment.getFilePath();
                  break;
                }
              }
            }
            if (!pdfPath) {
              throw new Error("No PDF attachment found for this item");
            }
            let webMetadata = null;
            let pdfMetadata = null;
            if (useWebService) {
              const retriever = new ZoteroMetadataRetriever(ztoolkit);
              try {
                webMetadata = await retriever.retrieveFromPDF(pdfPath);
                ztoolkit.log("[StreamableMCP] Web metadata retrieved:", webMetadata);
              } catch (error) {
                ztoolkit.log("[StreamableMCP] Web metadata retrieval failed:", error, "error");
              } finally {
                retriever.terminate();
              }
            }
            if (extractPDFProperties) {
              const extractor = new PDFMetadataExtractor(ztoolkit);
              try {
                pdfMetadata = await extractor.extractMetadata(pdfPath);
                ztoolkit.log("[StreamableMCP] PDF metadata extracted:", pdfMetadata);
              } catch (error) {
                ztoolkit.log("[StreamableMCP] PDF metadata extraction failed:", error, "error");
              } finally {
                extractor.terminate();
              }
            }
            if (fieldsToUpdate && Array.isArray(fieldsToUpdate) && webMetadata) {
              const filteredMetadata = { itemType: webMetadata.itemType };
              for (const field of fieldsToUpdate) {
                if (webMetadata[field]) {
                  filteredMetadata[field] = webMetadata[field];
                }
              }
              webMetadata = filteredMetadata;
            }
            const creator = new ItemCreator();
            const result = await creator.enrichExistingItem(
              itemKey,
              webMetadata || {},
              pdfMetadata || void 0,
              overwriteExisting
            );
            const updatedItem = Zotero.Items.getByLibraryAndKey(
              Zotero.Libraries.userLibraryID,
              result.itemKey
            );
            const responseData = {
              success: true,
              item: {
                key: result.itemKey,
                title: updatedItem.getField("title"),
                itemType: updatedItem.itemType
              },
              enrichmentSummary: {
                fieldsUpdated: result.fieldsUpdated,
                fieldsSkipped: result.fieldsSkipped,
                tagsAdded: result.tagsAdded,
                metadataSources: result.metadataSources
              }
            };
            return applyGlobalAIInstructions(responseData, "enrich_item_from_pdf");
          } catch (error) {
            ztoolkit.log("[StreamableMCP] enrich_item_from_pdf failed:", error, "error");
            throw error;
          }
        }
        /**
         * Format tool result for MCP response with intelligent content type detection
         */
        formatToolResult(result, toolName, args) {
          const requestedTextFormat = args?.format === "text";
          if (typeof result === "string") {
            return {
              content: [
                {
                  type: "text",
                  text: result
                }
              ],
              isError: false
            };
          }
          if (typeof result === "object" && result !== null) {
            if (requestedTextFormat) {
              return {
                content: [
                  {
                    type: "text",
                    text: this.formatObjectAsText(result, toolName)
                  }
                ],
                isError: false
              };
            }
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2)
                }
              ],
              isError: false,
              // Include raw structured data for programmatic access
              _structuredData: result,
              _contentType: "application/json"
            };
          }
          return {
            content: [
              {
                type: "text",
                text: String(result)
              }
            ],
            isError: false
          };
        }
        /**
         * Format object as human-readable text based on tool type
         */
        formatObjectAsText(obj, toolName) {
          switch (toolName) {
            case "get_content":
              return this.formatContentAsText(obj);
            case "search_library":
              return this.formatSearchResultsAsText(obj);
            case "get_annotations":
              return this.formatAnnotationsAsText(obj);
            default:
              return JSON.stringify(obj, null, 2);
          }
        }
        formatContentAsText(contentResult) {
          const parts = [];
          if (contentResult.title) {
            parts.push(`TITLE: ${contentResult.title}
`);
          }
          if (contentResult.content) {
            if (contentResult.content.abstract) {
              parts.push(`ABSTRACT:
${contentResult.content.abstract.content}
`);
            }
            if (contentResult.content.attachments) {
              for (const att of contentResult.content.attachments) {
                parts.push(`ATTACHMENT (${att.filename || att.type}):
${att.content}
`);
              }
            }
            if (contentResult.content.notes) {
              for (const note of contentResult.content.notes) {
                parts.push(`NOTE (${note.title}):
${note.content}
`);
              }
            }
          }
          return parts.join("\n---\n\n");
        }
        formatSearchResultsAsText(searchResult) {
          if (!searchResult.results || !Array.isArray(searchResult.results)) {
            return JSON.stringify(searchResult, null, 2);
          }
          const parts = [`SEARCH RESULTS (${searchResult.results.length} items):
`];
          searchResult.results.forEach((item, index) => {
            parts.push(`${index + 1}. ${item.title || "Untitled"}`);
            if (item.creators && item.creators.length > 0) {
              parts.push(`   Authors: ${item.creators.map((c) => c.name || `${c.firstName} ${c.lastName}`).join(", ")}`);
            }
            if (item.date) {
              parts.push(`   Date: ${item.date}`);
            }
            if (item.itemKey) {
              parts.push(`   Key: ${item.itemKey}`);
            }
            parts.push("");
          });
          return parts.join("\n");
        }
        formatAnnotationsAsText(annotationResult) {
          if (!annotationResult.data || !Array.isArray(annotationResult.data)) {
            return JSON.stringify(annotationResult, null, 2);
          }
          const parts = [`ANNOTATIONS (${annotationResult.data.length} items):
`];
          annotationResult.data.forEach((ann, index) => {
            parts.push(`${index + 1}. [${ann.type.toUpperCase()}] ${ann.content}`);
            if (ann.page) {
              parts.push(`   Page: ${ann.page}`);
            }
            if (ann.dateModified) {
              parts.push(`   Modified: ${ann.dateModified}`);
            }
            parts.push("");
          });
          return parts.join("\n");
        }
        createResponse(id, result) {
          return {
            jsonrpc: "2.0",
            id,
            result
          };
        }
        createError(id, code, message, data) {
          return {
            jsonrpc: "2.0",
            id,
            error: { code, message, data }
          };
        }
        /**
         * Get server status and capabilities
         */
        getStatus() {
          return {
            isInitialized: this.isInitialized,
            serverInfo: this.serverInfo,
            protocolVersion: "2024-11-05",
            supportedMethods: [
              "initialize",
              "initialized",
              "tools/list",
              "tools/call",
              "resources/list",
              "prompts/list",
              "ping"
            ],
            availableTools: [
              "search_library",
              "search_annotations",
              "get_item_details",
              "get_annotations",
              "get_content",
              "get_collections",
              "search_collections",
              "get_collection_details",
              "get_collection_items",
              "search_fulltext",
              "get_item_abstract"
            ],
            transport: {
              type: "streamable-http",
              keepAliveSupported: true,
              maxConnections: 100
            }
          };
        }
        /**
         * Get fulltext search mode configuration
         */
        getFulltextModeConfiguration(mode) {
          const modeConfigs = {
            "minimal": {
              contextLength: 100,
              maxResults: 20
            },
            "preview": {
              contextLength: 200,
              maxResults: 50
            },
            "standard": {
              contextLength: 250,
              maxResults: 100
            },
            "complete": {
              contextLength: 400,
              maxResults: 200
            }
          };
          return modeConfigs[mode] || modeConfigs["standard"];
        }
        /**
         * Get search mode configuration
         */
        getSearchModeConfiguration(mode) {
          const modeConfigs = {
            "minimal": {
              limit: 30
            },
            "preview": {
              limit: 100
            },
            "standard": {
              limit: 200
            },
            "complete": {
              limit: 500
            }
          };
          return modeConfigs[mode] || modeConfigs["standard"];
        }
        /**
         * Get collection mode configuration
         */
        getCollectionModeConfiguration(mode) {
          const modeConfigs = {
            "minimal": {
              limit: 20
            },
            "preview": {
              limit: 50
            },
            "standard": {
              limit: 100
            },
            "complete": {
              limit: 500
            }
          };
          return modeConfigs[mode] || modeConfigs["standard"];
        }
        /**
         * Get item details mode configuration
         */
        getItemDetailsModeConfiguration(mode) {
          const modeConfigs = {
            "minimal": {
              fields: ["key", "title", "creators", "date", "itemType"]
            },
            "preview": {
              fields: ["key", "title", "creators", "date", "itemType", "abstractNote", "tags", "collections"]
            },
            "standard": {
              fields: null
              // Include most fields (default behavior)
            },
            "complete": {
              fields: null
              // Include all fields
            }
          };
          return modeConfigs[mode] || modeConfigs["standard"];
        }
      };
    }
  });

  // node_modules/zotero-plugin-toolkit/dist/utils/debugBridge.js
  var DebugBridge = class _DebugBridge {
    static version = 2;
    static passwordPref = "extensions.zotero.debug-bridge.password";
    get version() {
      return _DebugBridge.version;
    }
    _disableDebugBridgePassword;
    get disableDebugBridgePassword() {
      return this._disableDebugBridgePassword;
    }
    set disableDebugBridgePassword(value) {
      this._disableDebugBridgePassword = value;
    }
    get password() {
      return BasicTool.getZotero().Prefs.get(_DebugBridge.passwordPref, true);
    }
    set password(v) {
      BasicTool.getZotero().Prefs.set(_DebugBridge.passwordPref, v, true);
    }
    constructor() {
      this._disableDebugBridgePassword = false;
      this.initializeDebugBridge();
    }
    static setModule(instance) {
      if (!instance.debugBridge?.version || instance.debugBridge.version < _DebugBridge.version) {
        instance.debugBridge = new _DebugBridge();
      }
    }
    initializeDebugBridge() {
      const debugBridgeExtension = {
        noContent: true,
        doAction: async (uri) => {
          const Zotero2 = BasicTool.getZotero();
          const window2 = Zotero2.getMainWindow();
          const uriString = uri.spec.split("//").pop();
          if (!uriString) {
            return;
          }
          const params = {};
          uriString.split("?").pop()?.split("&").forEach((p) => {
            params[p.split("=")[0]] = decodeURIComponent(p.split("=")[1]);
          });
          const skipPasswordCheck = toolkitGlobal_default.getInstance()?.debugBridge.disableDebugBridgePassword;
          let allowed = false;
          if (skipPasswordCheck) {
            allowed = true;
          } else {
            if (typeof params.password === "undefined" && typeof this.password === "undefined") {
              allowed = window2.confirm(`External App ${params.app} wants to execute command without password.
Command:
${(params.run || params.file || "").slice(0, 100)}
If you do not know what it is, please click Cancel to deny.`);
            } else {
              allowed = this.password === params.password;
            }
          }
          if (allowed) {
            if (params.run) {
              try {
                const AsyncFunction = Object.getPrototypeOf(async () => {
                }).constructor;
                const f = new AsyncFunction("Zotero,window", params.run);
                await f(Zotero2, window2);
              } catch (e) {
                Zotero2.debug(e);
                window2.console.log(e);
              }
            }
            if (params.file) {
              try {
                Services.scriptloader.loadSubScript(params.file, {
                  Zotero: Zotero2,
                  window: window2
                });
              } catch (e) {
                Zotero2.debug(e);
                window2.console.log(e);
              }
            }
          }
        },
        newChannel(uri) {
          this.doAction(uri);
        }
      };
      Services.io.getProtocolHandler("zotero").wrappedJSObject._extensions["zotero://ztoolkit-debug"] = debugBridgeExtension;
    }
  };

  // node_modules/zotero-plugin-toolkit/dist/utils/pluginBridge.js
  var PluginBridge = class _PluginBridge {
    static version = 1;
    get version() {
      return _PluginBridge.version;
    }
    constructor() {
      this.initializePluginBridge();
    }
    static setModule(instance) {
      if (!instance.pluginBridge?.version || instance.pluginBridge.version < _PluginBridge.version) {
        instance.pluginBridge = new _PluginBridge();
      }
    }
    initializePluginBridge() {
      const { AddonManager } = _importESModule("resource://gre/modules/AddonManager.sys.mjs");
      const Zotero2 = BasicTool.getZotero();
      const pluginBridgeExtension = {
        noContent: true,
        doAction: async (uri) => {
          try {
            const uriString = uri.spec.split("//").pop();
            if (!uriString) {
              return;
            }
            const params = {};
            uriString.split("?").pop()?.split("&").forEach((p) => {
              params[p.split("=")[0]] = decodeURIComponent(p.split("=")[1]);
            });
            if (params.action === "install" && params.url) {
              if (params.minVersion && Services.vc.compare(Zotero2.version, params.minVersion) < 0 || params.maxVersion && Services.vc.compare(Zotero2.version, params.maxVersion) > 0) {
                throw new Error(`Plugin is not compatible with Zotero version ${Zotero2.version}.The plugin requires Zotero version between ${params.minVersion} and ${params.maxVersion}.`);
              }
              const addon2 = await AddonManager.getInstallForURL(params.url);
              if (addon2 && addon2.state === AddonManager.STATE_AVAILABLE) {
                addon2.install();
                hint("Plugin installed successfully.", true);
              } else {
                throw new Error(`Plugin ${params.url} is not available.`);
              }
            }
          } catch (e) {
            Zotero2.logError(e);
            hint(e.message, false);
          }
        },
        newChannel(uri) {
          this.doAction(uri);
        }
      };
      Services.io.getProtocolHandler("zotero").wrappedJSObject._extensions["zotero://plugin"] = pluginBridgeExtension;
    }
  };
  function hint(content, success) {
    const progressWindow = new Zotero.ProgressWindow({ closeOnClick: true });
    progressWindow.changeHeadline("Plugin Toolkit");
    progressWindow.progress = new progressWindow.ItemProgress(success ? "chrome://zotero/skin/tick.png" : "chrome://zotero/skin/cross.png", content);
    progressWindow.progress.setProgress(100);
    progressWindow.show();
    progressWindow.startCloseTimer(5e3);
  }

  // node_modules/zotero-plugin-toolkit/dist/managers/toolkitGlobal.js
  var ToolkitGlobal = class _ToolkitGlobal {
    debugBridge;
    pluginBridge;
    prompt;
    currentWindow;
    constructor() {
      initializeModules(this);
      this.currentWindow = BasicTool.getZotero().getMainWindow();
    }
    /**
     * Get the global unique instance of `class ToolkitGlobal`.
     * @returns An instance of `ToolkitGlobal`.
     */
    static getInstance() {
      let _Zotero;
      try {
        if (typeof Zotero !== "undefined") {
          _Zotero = Zotero;
        } else {
          _Zotero = BasicTool.getZotero();
        }
      } catch {
      }
      if (!_Zotero) {
        return void 0;
      }
      let requireInit = false;
      if (!("_toolkitGlobal" in _Zotero)) {
        _Zotero._toolkitGlobal = new _ToolkitGlobal();
        requireInit = true;
      }
      const currentGlobal = _Zotero._toolkitGlobal;
      if (currentGlobal.currentWindow !== _Zotero.getMainWindow()) {
        checkWindowDependentModules(currentGlobal);
        requireInit = true;
      }
      if (requireInit) {
        initializeModules(currentGlobal);
      }
      return currentGlobal;
    }
  };
  function initializeModules(instance) {
    new BasicTool().log("Initializing ToolkitGlobal modules");
    setModule(instance, "prompt", {
      _ready: false,
      instance: void 0
    });
    DebugBridge.setModule(instance);
    PluginBridge.setModule(instance);
  }
  function setModule(instance, key, module) {
    if (!module) {
      return;
    }
    if (!instance[key]) {
      instance[key] = module;
    }
    for (const moduleKey in module) {
      instance[key][moduleKey] ??= module[moduleKey];
    }
  }
  function checkWindowDependentModules(instance) {
    instance.currentWindow = BasicTool.getZotero().getMainWindow();
    instance.prompt = void 0;
  }
  var toolkitGlobal_default = ToolkitGlobal;

  // node_modules/zotero-plugin-toolkit/dist/version.js
  var VERSION = "5.1.0-beta.4";

  // node_modules/zotero-plugin-toolkit/dist/basic.js
  var BasicTool = class _BasicTool {
    /**
     * configurations.
     */
    _basicOptions;
    _console;
    /**
     * @deprecated Use `patcherManager` instead.
     */
    patchSign = "zotero-plugin-toolkit@3.0.0";
    static _version = VERSION;
    /**
     * Get version - checks subclass first, then falls back to parent
     */
    get _version() {
      return VERSION;
    }
    get basicOptions() {
      return this._basicOptions;
    }
    /**
     *
     * @param data Pass an BasicTool instance to copy its options.
     */
    constructor(data) {
      this._basicOptions = {
        log: {
          _type: "toolkitlog",
          disableConsole: false,
          disableZLog: false,
          prefix: ""
        },
        // We will remove this in the future, for now just let it be lazy loaded.
        get debug() {
          if (this._debug) {
            return this._debug;
          }
          this._debug = toolkitGlobal_default.getInstance()?.debugBridge || {
            disableDebugBridgePassword: false,
            password: ""
          };
          return this._debug;
        },
        api: {
          pluginID: "zotero-plugin-toolkit@windingwind.com"
        },
        listeners: {
          callbacks: {
            onMainWindowLoad: /* @__PURE__ */ new Set(),
            onMainWindowUnload: /* @__PURE__ */ new Set(),
            onPluginUnload: /* @__PURE__ */ new Set()
          },
          _mainWindow: void 0,
          _plugin: void 0
        }
      };
      try {
        if (typeof globalThis.ChromeUtils?.importESModule !== "undefined" || typeof globalThis.ChromeUtils?.import !== "undefined") {
          const { ConsoleAPI } = _importESModule("resource://gre/modules/Console.sys.mjs");
          this._console = new ConsoleAPI({
            consoleID: `${this._basicOptions.api.pluginID}-${Date.now()}`
          });
        }
      } catch {
      }
      this.updateOptions(data);
    }
    getGlobal(k) {
      if (typeof globalThis[k] !== "undefined") {
        return globalThis[k];
      }
      const _Zotero = _BasicTool.getZotero();
      try {
        const window2 = _Zotero.getMainWindow();
        switch (k) {
          case "Zotero":
          case "zotero":
            return _Zotero;
          case "window":
            return window2;
          case "windows":
            return _Zotero.getMainWindows();
          case "document":
            return window2.document;
          case "ZoteroPane":
          case "ZoteroPane_Local":
            return _Zotero.getActiveZoteroPane();
          default:
            return window2[k];
        }
      } catch (e) {
        Zotero.logError(e);
      }
    }
    /**
     * If it's an XUL element
     * @param elem
     */
    isXULElement(elem) {
      return elem.namespaceURI === "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    }
    /**
     * Create an XUL element
     *
     * For Zotero 6, use `createElementNS`;
     *
     * For Zotero 7+, use `createXULElement`.
     * @param doc
     * @param type
     * @example
     * Create a `<menuitem>`:
     * ```ts
     * const compat = new ZoteroCompat();
     * const doc = compat.getWindow().document;
     * const elem = compat.createXULElement(doc, "menuitem");
     * ```
     */
    createXULElement(doc, type) {
      return doc.createXULElement(type);
    }
    /**
     * Output to both Zotero.debug and console.log
     * @param data e.g. string, number, object, ...
     */
    log(...data) {
      if (data.length === 0) {
        return;
      }
      let _Zotero;
      try {
        if (typeof Zotero !== "undefined") {
          _Zotero = Zotero;
        } else {
          _Zotero = _BasicTool.getZotero();
        }
      } catch {
      }
      let options;
      if (data[data.length - 1]?._type === "toolkitlog") {
        options = data.pop();
      } else {
        options = this._basicOptions.log;
      }
      try {
        if (options.prefix) {
          data.splice(0, 0, options.prefix);
        }
        if (!options.disableConsole) {
          let _console;
          if (typeof console !== "undefined") {
            _console = console;
          } else if (_Zotero) {
            _console = _Zotero.getMainWindow()?.console;
          }
          if (!_console) {
            if (!this._console) {
              return;
            }
            _console = this._console;
          }
          if (_console.groupCollapsed) {
            _console.groupCollapsed(...data);
          } else {
            _console.group(...data);
          }
          _console.trace();
          _console.groupEnd();
        }
        if (!options.disableZLog) {
          if (typeof _Zotero === "undefined") {
            return;
          }
          _Zotero.debug(data.map((d) => {
            try {
              return typeof d === "object" ? JSON.stringify(d) : String(d);
            } catch {
              _Zotero.debug(d);
              return "";
            }
          }).join("\n"));
        }
      } catch (e) {
        if (_Zotero)
          Zotero.logError(e);
        else {
          console.error(e);
        }
      }
    }
    /**
     * Patch a function
     * @deprecated Use {@link PatchHelper} instead.
     * @param object The owner of the function
     * @param funcSign The signature of the function(function name)
     * @param ownerSign The signature of patch owner to avoid patching again
     * @param patcher The new wrapper of the patched function
     */
    patch(object, funcSign, ownerSign, patcher) {
      if (object[funcSign][ownerSign]) {
        throw new Error(`${String(funcSign)} re-patched`);
      }
      this.log("patching", funcSign, `by ${ownerSign}`);
      object[funcSign] = patcher(object[funcSign]);
      object[funcSign][ownerSign] = true;
    }
    /**
     * Add a Zotero event listener callback
     * @param type Event type
     * @param callback Event callback
     */
    addListenerCallback(type, callback) {
      if (["onMainWindowLoad", "onMainWindowUnload"].includes(type)) {
        this._ensureMainWindowListener();
      }
      if (type === "onPluginUnload") {
        this._ensurePluginListener();
      }
      this._basicOptions.listeners.callbacks[type].add(callback);
    }
    /**
     * Remove a Zotero event listener callback
     * @param type Event type
     * @param callback Event callback
     */
    removeListenerCallback(type, callback) {
      this._basicOptions.listeners.callbacks[type].delete(callback);
      this._ensureRemoveListener();
    }
    /**
     * Remove all Zotero event listener callbacks when the last callback is removed.
     */
    _ensureRemoveListener() {
      const { listeners } = this._basicOptions;
      if (listeners._mainWindow && listeners.callbacks.onMainWindowLoad.size === 0 && listeners.callbacks.onMainWindowUnload.size === 0) {
        Services.wm.removeListener(listeners._mainWindow);
        delete listeners._mainWindow;
      }
      if (listeners._plugin && listeners.callbacks.onPluginUnload.size === 0) {
        Zotero.Plugins.removeObserver(listeners._plugin);
        delete listeners._plugin;
      }
    }
    /**
     * Ensure the main window listener is registered.
     */
    _ensureMainWindowListener() {
      if (this._basicOptions.listeners._mainWindow) {
        return;
      }
      const mainWindowListener = {
        onOpenWindow: (xulWindow) => {
          const domWindow = xulWindow.docShell.domWindow;
          const onload = async () => {
            domWindow.removeEventListener("load", onload, false);
            if (domWindow.location.href !== "chrome://zotero/content/zoteroPane.xhtml") {
              return;
            }
            for (const cbk of this._basicOptions.listeners.callbacks.onMainWindowLoad) {
              try {
                cbk(domWindow);
              } catch (e) {
                this.log(e);
              }
            }
          };
          domWindow.addEventListener("load", () => onload(), false);
        },
        onCloseWindow: async (xulWindow) => {
          const domWindow = xulWindow.docShell.domWindow;
          if (domWindow.location.href !== "chrome://zotero/content/zoteroPane.xhtml") {
            return;
          }
          for (const cbk of this._basicOptions.listeners.callbacks.onMainWindowUnload) {
            try {
              cbk(domWindow);
            } catch (e) {
              this.log(e);
            }
          }
        }
      };
      this._basicOptions.listeners._mainWindow = mainWindowListener;
      Services.wm.addListener(mainWindowListener);
    }
    /**
     * Ensure the plugin listener is registered.
     */
    _ensurePluginListener() {
      if (this._basicOptions.listeners._plugin) {
        return;
      }
      const pluginListener = {
        shutdown: (...args) => {
          for (const cbk of this._basicOptions.listeners.callbacks.onPluginUnload) {
            try {
              cbk(...args);
            } catch (e) {
              this.log(e);
            }
          }
        }
      };
      this._basicOptions.listeners._plugin = pluginListener;
      Zotero.Plugins.addObserver(pluginListener);
    }
    updateOptions(source) {
      if (!source) {
        return this;
      }
      if (source instanceof _BasicTool) {
        this._basicOptions = source._basicOptions;
      } else {
        this._basicOptions = source;
      }
      return this;
    }
    static getZotero() {
      if (typeof Zotero !== "undefined") {
        return Zotero;
      }
      const { Zotero: _Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");
      return _Zotero;
    }
  };
  var ManagerTool = class extends BasicTool {
    _ensureAutoUnregisterAll() {
      this.addListenerCallback("onPluginUnload", (params, _reason) => {
        if (params.id !== this.basicOptions.api.pluginID) {
          return;
        }
        this.unregisterAll();
      });
    }
  };
  function unregister(tools) {
    Object.values(tools).forEach((tool) => {
      if (tool instanceof ManagerTool || typeof tool?.unregisterAll === "function") {
        tool.unregisterAll();
      }
    });
  }
  function makeHelperTool(cls, options) {
    return new Proxy(cls, {
      construct(target, args) {
        const _origin = new cls(...args);
        if (_origin instanceof BasicTool) {
          _origin.updateOptions(options);
        } else {
          _origin._version = BasicTool._version;
        }
        return _origin;
      }
    });
  }
  function _importESModule(path) {
    if (typeof ChromeUtils.import === "undefined") {
      return ChromeUtils.importESModule(path, { global: "contextual" });
    }
    if (path.endsWith(".sys.mjs")) {
      path = path.replace(/\.sys\.mjs$/, ".jsm");
    }
    return ChromeUtils.import(path);
  }

  // node_modules/zotero-plugin-toolkit/dist/helpers/clipboard.js
  var ClipboardHelper = class extends BasicTool {
    transferable;
    clipboardService;
    filePath = "";
    constructor() {
      super();
      this.transferable = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
      this.clipboardService = Components.classes["@mozilla.org/widget/clipboard;1"].getService(Components.interfaces.nsIClipboard);
      this.transferable.init(null);
    }
    addText(source, type = "text/plain") {
      const str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
      str.data = source;
      if (type === "text/unicode")
        type = "text/plain";
      this.transferable.addDataFlavor(type);
      this.transferable.setTransferData(type, str, source.length * 2);
      return this;
    }
    addImage(source) {
      const parts = source.split(",");
      if (!parts[0].includes("base64")) {
        return this;
      }
      const mime = parts[0].match(/:(.*?);/)[1];
      const bstr = this.getGlobal("window").atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const imgTools = Components.classes["@mozilla.org/image/tools;1"].getService(Components.interfaces.imgITools);
      let mimeType;
      let img;
      if (this.getGlobal("Zotero").platformMajorVersion >= 102) {
        img = imgTools.decodeImageFromArrayBuffer(u8arr.buffer, mime);
        mimeType = "application/x-moz-nativeimage";
      } else {
        mimeType = `image/png`;
        img = Components.classes["@mozilla.org/supports-interface-pointer;1"].createInstance(Components.interfaces.nsISupportsInterfacePointer);
        img.data = imgTools.decodeImageFromArrayBuffer(u8arr.buffer, mimeType);
      }
      this.transferable.addDataFlavor(mimeType);
      this.transferable.setTransferData(mimeType, img, 0);
      return this;
    }
    addFile(path) {
      const file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      file.initWithPath(path);
      this.transferable.addDataFlavor("application/x-moz-file");
      this.transferable.setTransferData("application/x-moz-file", file);
      this.filePath = path;
      return this;
    }
    copy() {
      try {
        this.clipboardService.setData(this.transferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
      } catch (e) {
        if (this.filePath && Zotero.isMac) {
          Zotero.Utilities.Internal.exec(`/usr/bin/osascript`, [
            `-e`,
            `set the clipboard to POSIX file "${this.filePath}"`
          ]);
        } else {
          throw e;
        }
      }
      return this;
    }
  };

  // node_modules/zotero-plugin-toolkit/dist/tools/ui.js
  var UITool = class extends BasicTool {
    get basicOptions() {
      return this._basicOptions;
    }
    /**
     * Store elements created with this instance
     *
     * @remarks
     * > What is this for?
     *
     * In bootstrap plugins, elements must be manually maintained and removed on exiting.
     *
     * This API does this for you.
     */
    elementCache;
    constructor(base) {
      super(base);
      this.elementCache = [];
      if (!this._basicOptions.ui) {
        this._basicOptions.ui = {
          enableElementRecord: true,
          enableElementJSONLog: false,
          enableElementDOMLog: true
        };
      }
    }
    /**
     * Remove all elements created by `createElement`.
     *
     * @remarks
     * > What is this for?
     *
     * In bootstrap plugins, elements must be manually maintained and removed on exiting.
     *
     * This API does this for you.
     */
    unregisterAll() {
      this.elementCache.forEach((e) => {
        try {
          e?.deref()?.remove();
        } catch (e2) {
          this.log(e2);
        }
      });
    }
    createElement(...args) {
      const doc = args[0];
      const tagName = args[1].toLowerCase();
      let props = args[2] || {};
      if (!tagName) {
        return;
      }
      if (typeof args[2] === "string") {
        props = {
          namespace: args[2],
          enableElementRecord: args[3]
        };
      }
      if (typeof props.enableElementJSONLog !== "undefined" && props.enableElementJSONLog || this.basicOptions.ui.enableElementJSONLog) {
        this.log(props);
      }
      props.properties = props.properties || props.directAttributes;
      props.children = props.children || props.subElementOptions;
      let elem;
      if (tagName === "fragment") {
        const fragElem = doc.createDocumentFragment();
        elem = fragElem;
      } else {
        let realElem = props.id && (props.checkExistenceParent ? props.checkExistenceParent : doc).querySelector(`#${props.id}`);
        if (realElem && props.ignoreIfExists) {
          return realElem;
        }
        if (realElem && props.removeIfExists) {
          realElem.remove();
          realElem = void 0;
        }
        if (props.customCheck && !props.customCheck(doc, props)) {
          return void 0;
        }
        if (!realElem || !props.skipIfExists) {
          let namespace = props.namespace;
          if (!namespace) {
            const mightHTML = HTMLElementTagNames.includes(tagName);
            const mightXUL = XULElementTagNames.includes(tagName);
            const mightSVG = SVGElementTagNames.includes(tagName);
            if (Number(mightHTML) + Number(mightXUL) + Number(mightSVG) > 1) {
              this.log(`[Warning] Creating element ${tagName} with no namespace specified. Found multiply namespace matches.`);
            }
            if (mightHTML) {
              namespace = "html";
            } else if (mightXUL) {
              namespace = "xul";
            } else if (mightSVG) {
              namespace = "svg";
            } else {
              namespace = "html";
            }
          }
          if (namespace === "xul") {
            realElem = this.createXULElement(doc, tagName);
          } else {
            realElem = doc.createElementNS({
              html: "http://www.w3.org/1999/xhtml",
              svg: "http://www.w3.org/2000/svg"
            }[namespace], tagName);
          }
          if (typeof props.enableElementRecord !== "undefined" ? props.enableElementRecord : this.basicOptions.ui.enableElementRecord) {
            this.elementCache.push(new WeakRef(realElem));
          }
        }
        if (props.id) {
          realElem.id = props.id;
        }
        if (props.styles && Object.keys(props.styles).length) {
          Object.keys(props.styles).forEach((k) => {
            const v = props.styles[k];
            typeof v !== "undefined" && (realElem.style[k] = v);
          });
        }
        if (props.properties && Object.keys(props.properties).length) {
          Object.keys(props.properties).forEach((k) => {
            const v = props.properties[k];
            typeof v !== "undefined" && (realElem[k] = v);
          });
        }
        if (props.attributes && Object.keys(props.attributes).length) {
          Object.keys(props.attributes).forEach((k) => {
            const v = props.attributes[k];
            typeof v !== "undefined" && realElem.setAttribute(k, String(v));
          });
        }
        if (props.classList?.length) {
          realElem.classList.add(...props.classList);
        }
        if (props.listeners?.length) {
          props.listeners.forEach(({ type, listener, options }) => {
            listener && realElem.addEventListener(type, listener, options);
          });
        }
        elem = realElem;
      }
      if (props.children?.length) {
        const subElements = props.children.map((childProps) => {
          childProps.namespace = childProps.namespace || props.namespace;
          return this.createElement(doc, childProps.tag, childProps);
        }).filter((e) => e);
        elem.append(...subElements);
      }
      if (typeof props.enableElementDOMLog !== "undefined" ? props.enableElementDOMLog : this.basicOptions.ui.enableElementDOMLog) {
        this.log(elem);
      }
      return elem;
    }
    /**
     * Append element(s) to a node.
     * @param properties See {@link ElementProps}
     * @param container The parent node to append to.
     * @returns A Node that is the appended child (aChild),
     *          except when aChild is a DocumentFragment,
     *          in which case the empty DocumentFragment is returned.
     */
    appendElement(properties, container) {
      return container.appendChild(this.createElement(container.ownerDocument, properties.tag, properties));
    }
    /**
     * Inserts a node before a reference node as a child of its parent node.
     * @param properties See {@link ElementProps}
     * @param referenceNode The node before which newNode is inserted.
     * @returns Node
     */
    insertElementBefore(properties, referenceNode) {
      if (referenceNode.parentNode)
        return referenceNode.parentNode.insertBefore(this.createElement(referenceNode.ownerDocument, properties.tag, properties), referenceNode);
      else
        this.log(`${referenceNode.tagName} has no parent, cannot insert ${properties.tag}`);
    }
    /**
     * Replace oldNode with a new one.
     * @param properties See {@link ElementProps}
     * @param oldNode The child to be replaced.
     * @returns The replaced Node. This is the same node as oldChild.
     */
    replaceElement(properties, oldNode) {
      if (oldNode.parentNode)
        return oldNode.parentNode.replaceChild(this.createElement(oldNode.ownerDocument, properties.tag, properties), oldNode);
      else
        this.log(`${oldNode.tagName} has no parent, cannot replace it with ${properties.tag}`);
    }
    /**
     * Parse XHTML to XUL fragment. For Zotero 6.
     *
     * To load preferences from a Zotero 7's `.xhtml`, use this method to parse it.
     * @param str xhtml raw text
     * @param entities dtd file list ("chrome://xxx.dtd")
     * @param defaultXUL true for default XUL namespace
     */
    parseXHTMLToFragment(str, entities = [], defaultXUL = true) {
      const parser = new DOMParser();
      const xulns = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
      const htmlns = "http://www.w3.org/1999/xhtml";
      const wrappedStr = `${entities.length ? `<!DOCTYPE bindings [ ${entities.reduce((preamble, url, index) => {
        return `${preamble}<!ENTITY % _dtd-${index} SYSTEM "${url}"> %_dtd-${index}; `;
      }, "")}]>` : ""}
      <html:div xmlns="${defaultXUL ? xulns : htmlns}"
          xmlns:xul="${xulns}" xmlns:html="${htmlns}">
      ${str}
      </html:div>`;
      this.log(wrappedStr, parser);
      const doc = parser.parseFromString(wrappedStr, "text/xml");
      this.log(doc);
      if (doc.documentElement.localName === "parsererror") {
        throw new Error("not well-formed XHTML");
      }
      const range = doc.createRange();
      range.selectNodeContents(doc.querySelector("div"));
      return range.extractContents();
    }
  };
  var HTMLElementTagNames = [
    "a",
    "abbr",
    "address",
    "area",
    "article",
    "aside",
    "audio",
    "b",
    "base",
    "bdi",
    "bdo",
    "blockquote",
    "body",
    "br",
    "button",
    "canvas",
    "caption",
    "cite",
    "code",
    "col",
    "colgroup",
    "data",
    "datalist",
    "dd",
    "del",
    "details",
    "dfn",
    "dialog",
    "div",
    "dl",
    "dt",
    "em",
    "embed",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "head",
    "header",
    "hgroup",
    "hr",
    "html",
    "i",
    "iframe",
    "img",
    "input",
    "ins",
    "kbd",
    "label",
    "legend",
    "li",
    "link",
    "main",
    "map",
    "mark",
    "menu",
    "meta",
    "meter",
    "nav",
    "noscript",
    "object",
    "ol",
    "optgroup",
    "option",
    "output",
    "p",
    "picture",
    "pre",
    "progress",
    "q",
    "rp",
    "rt",
    "ruby",
    "s",
    "samp",
    "script",
    "section",
    "select",
    "slot",
    "small",
    "source",
    "span",
    "strong",
    "style",
    "sub",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "template",
    "textarea",
    "tfoot",
    "th",
    "thead",
    "time",
    "title",
    "tr",
    "track",
    "u",
    "ul",
    "var",
    "video",
    "wbr"
  ];
  var XULElementTagNames = [
    "action",
    "arrowscrollbox",
    "bbox",
    "binding",
    "bindings",
    "box",
    "broadcaster",
    "broadcasterset",
    "button",
    "browser",
    "checkbox",
    "caption",
    "colorpicker",
    "column",
    "columns",
    "commandset",
    "command",
    "conditions",
    "content",
    "deck",
    "description",
    "dialog",
    "dialogheader",
    "editor",
    "grid",
    "grippy",
    "groupbox",
    "hbox",
    "iframe",
    "image",
    "key",
    "keyset",
    "label",
    "listbox",
    "listcell",
    "listcol",
    "listcols",
    "listhead",
    "listheader",
    "listitem",
    "member",
    "menu",
    "menubar",
    "menuitem",
    "menulist",
    "menupopup",
    "menuseparator",
    "observes",
    "overlay",
    "page",
    "popup",
    "popupset",
    "preference",
    "preferences",
    "prefpane",
    "prefwindow",
    "progressmeter",
    "radio",
    "radiogroup",
    "resizer",
    "richlistbox",
    "richlistitem",
    "row",
    "rows",
    "rule",
    "script",
    "scrollbar",
    "scrollbox",
    "scrollcorner",
    "separator",
    "spacer",
    "splitter",
    "stack",
    "statusbar",
    "statusbarpanel",
    "stringbundle",
    "stringbundleset",
    "tab",
    "tabbrowser",
    "tabbox",
    "tabpanel",
    "tabpanels",
    "tabs",
    "template",
    "textnode",
    "textbox",
    "titlebar",
    "toolbar",
    "toolbarbutton",
    "toolbargrippy",
    "toolbaritem",
    "toolbarpalette",
    "toolbarseparator",
    "toolbarset",
    "toolbarspacer",
    "toolbarspring",
    "toolbox",
    "tooltip",
    "tree",
    "treecell",
    "treechildren",
    "treecol",
    "treecols",
    "treeitem",
    "treerow",
    "treeseparator",
    "triple",
    "vbox",
    "window",
    "wizard",
    "wizardpage"
  ];
  var SVGElementTagNames = [
    "a",
    "animate",
    "animateMotion",
    "animateTransform",
    "circle",
    "clipPath",
    "defs",
    "desc",
    "ellipse",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feDropShadow",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "filter",
    "foreignObject",
    "g",
    "image",
    "line",
    "linearGradient",
    "marker",
    "mask",
    "metadata",
    "mpath",
    "path",
    "pattern",
    "polygon",
    "polyline",
    "radialGradient",
    "rect",
    "script",
    "set",
    "stop",
    "style",
    "svg",
    "switch",
    "symbol",
    "text",
    "textPath",
    "title",
    "tspan",
    "use",
    "view"
  ];

  // node_modules/zotero-plugin-toolkit/dist/helpers/dialog.js
  var DialogHelper = class extends UITool {
    /**
     * Passed to dialog window for data-binding and lifecycle controls. See {@link DialogHelper.setDialogData}
     */
    dialogData;
    /**
     * Dialog window instance
     */
    window;
    elementProps;
    /**
     * Create a dialog helper with row \* column grids.
     * @param row
     * @param column
     */
    constructor(row, column) {
      super();
      if (row <= 0 || column <= 0) {
        throw new Error(`row and column must be positive integers.`);
      }
      this.elementProps = {
        tag: "vbox",
        attributes: { flex: 1 },
        styles: {
          width: "100%",
          height: "100%"
        },
        children: []
      };
      for (let i = 0; i < Math.max(row, 1); i++) {
        this.elementProps.children.push({
          tag: "hbox",
          attributes: { flex: 1 },
          children: []
        });
        for (let j = 0; j < Math.max(column, 1); j++) {
          this.elementProps.children[i].children.push({
            tag: "vbox",
            attributes: { flex: 1 },
            children: []
          });
        }
      }
      this.elementProps.children.push({
        tag: "hbox",
        attributes: { flex: 0, pack: "end" },
        children: []
      });
      this.dialogData = {};
    }
    /**
     * Add a cell at (row, column). Index starts from 0.
     * @param row
     * @param column
     * @param elementProps Cell element props. See {@link ElementProps}
     * @param cellFlex If the cell is flex. Default true.
     */
    addCell(row, column, elementProps, cellFlex = true) {
      if (row >= this.elementProps.children.length || column >= this.elementProps.children[row].children.length) {
        throw new Error(`Cell index (${row}, ${column}) is invalid, maximum (${this.elementProps.children.length}, ${this.elementProps.children[0].children.length})`);
      }
      this.elementProps.children[row].children[column].children = [
        elementProps
      ];
      this.elementProps.children[row].children[column].attributes.flex = cellFlex ? 1 : 0;
      return this;
    }
    /**
     * Add a control button to the bottom of the dialog.
     * @param label Button label
     * @param id Button id.
     * The corresponding id of the last button user clicks before window exit will be set to `dialogData._lastButtonId`.
     * @param options Options
     * @param [options.noClose] Don't close window when clicking this button.
     * @param [options.callback] Callback of button click event.
     */
    addButton(label, id, options = {}) {
      id = id || `btn-${Zotero.Utilities.randomString()}-${(/* @__PURE__ */ new Date()).getTime()}`;
      this.elementProps.children[this.elementProps.children.length - 1].children.push({
        tag: "vbox",
        styles: {
          margin: "10px"
        },
        children: [
          {
            tag: "button",
            namespace: "html",
            id,
            attributes: {
              type: "button",
              "data-l10n-id": label
            },
            properties: {
              innerHTML: label
            },
            listeners: [
              {
                type: "click",
                listener: (e) => {
                  this.dialogData._lastButtonId = id;
                  if (options.callback) {
                    options.callback(e);
                  }
                  if (!options.noClose) {
                    this.window.close();
                  }
                }
              }
            ]
          }
        ]
      });
      return this;
    }
    /**
     * Dialog data.
     * @remarks
     * This object is passed to the dialog window.
     *
     * The control button id is in `dialogData._lastButtonId`;
     *
     * The data-binding values are in `dialogData`.
     * ```ts
     * interface DialogData {
     *   [key: string | number | symbol]: any;
     *   loadLock?: { promise: Promise<void>; resolve: () => void; isResolved: () => boolean }; // resolve after window load (auto-generated)
     *   loadCallback?: Function; // called after window load
     *   unloadLock?: { promise: Promise<void>; resolve: () => void }; // resolve after window unload (auto-generated)
     *   unloadCallback?: Function; // called after window unload
     *   beforeUnloadCallback?: Function; // called before window unload when elements are accessable.
     * }
     * ```
     * @param dialogData
     */
    setDialogData(dialogData) {
      this.dialogData = dialogData;
      return this;
    }
    /**
     * Open the dialog
     * @param title Window title
     * @param windowFeatures
     * @param windowFeatures.width Ignored if fitContent is `true`.
     * @param windowFeatures.height Ignored if fitContent is `true`.
     * @param windowFeatures.left
     * @param windowFeatures.top
     * @param windowFeatures.centerscreen Open window at the center of screen.
     * @param windowFeatures.resizable If window is resizable.
     * @param windowFeatures.fitContent Resize the window to content size after elements are loaded.
     * @param windowFeatures.noDialogMode Dialog mode window only has a close button. Set `true` to make maximize and minimize button visible.
     * @param windowFeatures.alwaysRaised Is the window always at the top.
     */
    open(title, windowFeatures = {
      centerscreen: true,
      resizable: true,
      fitContent: true
    }) {
      this.window = openDialog(this, `dialog-${Zotero.Utilities.randomString()}-${(/* @__PURE__ */ new Date()).getTime()}`, title, this.elementProps, this.dialogData, windowFeatures);
      return this;
    }
  };
  function openDialog(dialogHelper, targetId, title, elementProps, dialogData, windowFeatures = {
    centerscreen: true,
    resizable: true,
    fitContent: true
  }) {
    dialogData = dialogData || {};
    if (!dialogData.loadLock) {
      let loadResolve;
      let isLoadResolved = false;
      const loadPromise = new Promise((resolve) => {
        loadResolve = resolve;
      });
      loadPromise.then(() => {
        isLoadResolved = true;
      });
      dialogData.loadLock = {
        promise: loadPromise,
        resolve: loadResolve,
        isResolved: () => isLoadResolved
      };
    }
    if (!dialogData.unloadLock) {
      let unloadResolve;
      const unloadPromise = new Promise((resolve) => {
        unloadResolve = resolve;
      });
      dialogData.unloadLock = {
        promise: unloadPromise,
        resolve: unloadResolve
      };
    }
    let featureString = `resizable=${windowFeatures.resizable ? "yes" : "no"},`;
    if (windowFeatures.width || windowFeatures.height) {
      featureString += `width=${windowFeatures.width || 100},height=${windowFeatures.height || 100},`;
    }
    if (windowFeatures.left) {
      featureString += `left=${windowFeatures.left},`;
    }
    if (windowFeatures.top) {
      featureString += `top=${windowFeatures.top},`;
    }
    if (windowFeatures.centerscreen) {
      featureString += "centerscreen,";
    }
    if (windowFeatures.noDialogMode) {
      featureString += "dialog=no,";
    }
    if (windowFeatures.alwaysRaised) {
      featureString += "alwaysRaised=yes,";
    }
    const win = dialogHelper.getGlobal("openDialog")("about:blank", targetId || "_blank", featureString, dialogData);
    dialogData.loadLock?.promise.then(() => {
      win.document.head.appendChild(dialogHelper.createElement(win.document, "title", {
        properties: { innerText: title },
        attributes: { "data-l10n-id": title }
      }));
      let l10nFiles = dialogData.l10nFiles || [];
      if (typeof l10nFiles === "string") {
        l10nFiles = [l10nFiles];
      }
      l10nFiles.forEach((file) => {
        win.document.head.appendChild(dialogHelper.createElement(win.document, "link", {
          properties: {
            rel: "localization",
            href: file
          }
        }));
      });
      dialogHelper.appendElement({
        tag: "fragment",
        children: [
          {
            tag: "style",
            properties: {
              // eslint-disable-next-line ts/no-use-before-define
              innerHTML: style
            }
          },
          {
            tag: "link",
            properties: {
              rel: "stylesheet",
              href: "chrome://zotero-platform/content/zotero.css"
            }
          }
        ]
      }, win.document.head);
      replaceElement(elementProps, dialogHelper);
      win.document.body.appendChild(dialogHelper.createElement(win.document, "fragment", {
        children: [elementProps]
      }));
      Array.from(win.document.querySelectorAll("*[data-bind]")).forEach((elem) => {
        const bindKey = elem.getAttribute("data-bind");
        const bindAttr = elem.getAttribute("data-attr");
        const bindProp = elem.getAttribute("data-prop");
        if (bindKey && dialogData && dialogData[bindKey]) {
          if (bindProp) {
            elem[bindProp] = dialogData[bindKey];
          } else {
            elem.setAttribute(bindAttr || "value", dialogData[bindKey]);
          }
        }
      });
      if (windowFeatures.fitContent) {
        setTimeout(() => {
          win.sizeToContent();
        }, 300);
      }
      win.focus();
    }).then(() => {
      dialogData?.loadCallback && dialogData.loadCallback();
    });
    dialogData.unloadLock?.promise.then(() => {
      dialogData?.unloadCallback && dialogData.unloadCallback();
    });
    win.addEventListener("DOMContentLoaded", function onWindowLoad(_ev) {
      win.arguments[0]?.loadLock?.resolve();
      win.removeEventListener("DOMContentLoaded", onWindowLoad, false);
    }, false);
    win.addEventListener("beforeunload", function onWindowBeforeUnload(_ev) {
      Array.from(win.document.querySelectorAll("*[data-bind]")).forEach((elem) => {
        const dialogData2 = this.window.arguments[0];
        const bindKey = elem.getAttribute("data-bind");
        const bindAttr = elem.getAttribute("data-attr");
        const bindProp = elem.getAttribute("data-prop");
        if (bindKey && dialogData2) {
          if (bindProp) {
            dialogData2[bindKey] = elem[bindProp];
          } else {
            dialogData2[bindKey] = elem.getAttribute(bindAttr || "value");
          }
        }
      });
      this.window.removeEventListener("beforeunload", onWindowBeforeUnload, false);
      dialogData?.beforeUnloadCallback && dialogData.beforeUnloadCallback();
    });
    win.addEventListener("unload", function onWindowUnload(_ev) {
      if (!this.window.arguments[0]?.loadLock?.isResolved()) {
        return;
      }
      this.window.arguments[0]?.unloadLock?.resolve();
      this.window.removeEventListener("unload", onWindowUnload, false);
    });
    if (win.document.readyState === "complete") {
      win.arguments[0]?.loadLock?.resolve();
    }
    return win;
  }
  function replaceElement(elementProps, uiTool) {
    let checkChildren = true;
    if (elementProps.tag === "select") {
      checkChildren = false;
      const customSelectProps = {
        tag: "div",
        classList: ["dropdown"],
        listeners: [
          {
            type: "mouseleave",
            listener: (ev) => {
              const select = ev.target.querySelector("select");
              select?.blur();
            }
          }
        ],
        children: [
          Object.assign({}, elementProps, {
            tag: "select",
            listeners: [
              {
                type: "focus",
                listener: (ev) => {
                  const select = ev.target;
                  const dropdown = select.parentElement?.querySelector(".dropdown-content");
                  dropdown && (dropdown.style.display = "block");
                  select.setAttribute("focus", "true");
                }
              },
              {
                type: "blur",
                listener: (ev) => {
                  const select = ev.target;
                  const dropdown = select.parentElement?.querySelector(".dropdown-content");
                  dropdown && (dropdown.style.display = "none");
                  select.removeAttribute("focus");
                }
              }
            ]
          }),
          {
            tag: "div",
            classList: ["dropdown-content"],
            children: elementProps.children?.map((option) => ({
              tag: "p",
              attributes: {
                value: option.properties?.value
              },
              properties: {
                innerHTML: option.properties?.innerHTML || option.properties?.textContent
              },
              classList: ["dropdown-item"],
              listeners: [
                {
                  type: "click",
                  listener: (ev) => {
                    const select = ev.target.parentElement?.previousElementSibling;
                    select && (select.value = ev.target.getAttribute("value") || "");
                    select?.blur();
                  }
                }
              ]
            }))
          }
        ]
      };
      for (const key in elementProps) {
        delete elementProps[key];
      }
      Object.assign(elementProps, customSelectProps);
    } else if (elementProps.tag === "a") {
      const href = elementProps?.properties?.href || "";
      elementProps.properties ??= {};
      elementProps.properties.href = "javascript:void(0);";
      elementProps.attributes ??= {};
      elementProps.attributes["zotero-href"] = href;
      elementProps.listeners ??= [];
      elementProps.listeners.push({
        type: "click",
        listener: (ev) => {
          const href2 = ev.target?.getAttribute("zotero-href");
          href2 && uiTool.getGlobal("Zotero").launchURL(href2);
        }
      });
      elementProps.classList ??= [];
      elementProps.classList.push("zotero-text-link");
    }
    if (checkChildren) {
      elementProps.children?.forEach((child) => replaceElement(child, uiTool));
    }
  }
  var style = `
html {
  color-scheme: light dark;
}
.zotero-text-link {
  -moz-user-focus: normal;
  color: -moz-nativehyperlinktext;
  text-decoration: underline;
  border: 1px solid transparent;
  cursor: pointer;
}
.dropdown {
  position: relative;
  display: inline-block;
}
.dropdown-content {
  display: none;
  position: absolute;
  background-color: var(--material-toolbar);
  min-width: 160px;
  box-shadow: 0px 0px 5px 0px rgba(0, 0, 0, 0.5);
  border-radius: 5px;
  padding: 5px 0 5px 0;
  z-index: 999;
}
.dropdown-item {
  margin: 0px;
  padding: 5px 10px 5px 10px;
}
.dropdown-item:hover {
  background-color: var(--fill-quinary);
}
`;

  // node_modules/zotero-plugin-toolkit/dist/helpers/filePicker.js
  var FilePickerHelper = class extends BasicTool {
    title;
    mode;
    filters;
    suggestion;
    directory;
    window;
    filterMask;
    constructor(title, mode, filters, suggestion, window2, filterMask, directory) {
      super();
      this.title = title;
      this.mode = mode;
      this.filters = filters;
      this.suggestion = suggestion;
      this.directory = directory;
      this.window = window2;
      this.filterMask = filterMask;
    }
    async open() {
      const Backend = ChromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs").FilePicker;
      const fp = new Backend();
      fp.init(this.window || this.getGlobal("window"), this.title, this.getMode(fp));
      for (const [label, ext] of this.filters || []) {
        fp.appendFilter(label, ext);
      }
      if (this.filterMask)
        fp.appendFilters(this.getFilterMask(fp));
      if (this.suggestion)
        fp.defaultString = this.suggestion;
      if (this.directory)
        fp.displayDirectory = this.directory;
      const userChoice = await fp.show();
      switch (userChoice) {
        case fp.returnOK:
        case fp.returnReplace:
          return this.mode === "multiple" ? fp.files : fp.file;
        default:
          return false;
      }
    }
    getMode(fp) {
      switch (this.mode) {
        case "open":
          return fp.modeOpen;
        case "save":
          return fp.modeSave;
        case "folder":
          return fp.modeGetFolder;
        case "multiple":
          return fp.modeOpenMultiple;
        default:
          return 0;
      }
    }
    getFilterMask(fp) {
      switch (this.filterMask) {
        case "all":
          return fp.filterAll;
        case "html":
          return fp.filterHTML;
        case "text":
          return fp.filterText;
        case "images":
          return fp.filterImages;
        case "xml":
          return fp.filterXML;
        case "apps":
          return fp.filterApps;
        case "urls":
          return fp.filterAllowURLs;
        case "audio":
          return fp.filterAudio;
        case "video":
          return fp.filterVideo;
        default:
          return 1;
      }
    }
  };

  // node_modules/zotero-plugin-toolkit/dist/helpers/guide.js
  var GuideHelper = class extends BasicTool {
    _steps = [];
    constructor() {
      super();
    }
    addStep(step) {
      this._steps.push(step);
      return this;
    }
    addSteps(steps) {
      this._steps.push(...steps);
      return this;
    }
    async show(doc) {
      if (!doc?.ownerGlobal) {
        throw new Error("Document is required.");
      }
      const guide = new Guide(doc.ownerGlobal);
      await guide.show(this._steps);
      const promise = new Promise((resolve) => {
        guide._panel.addEventListener("guide-finished", () => resolve(guide));
      });
      await promise;
      return guide;
    }
    async highlight(doc, step) {
      if (!doc?.ownerGlobal) {
        throw new Error("Document is required.");
      }
      const guide = new Guide(doc.ownerGlobal);
      await guide.show([step]);
      const promise = new Promise((resolve) => {
        guide._panel.addEventListener("guide-finished", () => resolve(guide));
      });
      await promise;
      return guide;
    }
  };
  var Guide = class {
    _window;
    _id = `guide-${Zotero.Utilities.randomString()}`;
    _panel;
    _header;
    _body;
    _footer;
    _progress;
    _closeButton;
    _prevButton;
    _nextButton;
    _steps;
    _noClose;
    _closed;
    _autoNext;
    _currentIndex;
    initialized;
    _cachedMasks = [];
    get content() {
      return this._window.MozXULElement.parseXULToFragment(`
      <panel id="${this._id}" class="guide-panel" type="arrow" align="top" noautohide="true">
          <html:div class="guide-panel-content">
              <html:div class="guide-panel-header"></html:div>
              <html:div class="guide-panel-body"></html:div>
              <html:div class="guide-panel-footer">
                  <html:div class="guide-panel-progress"></html:div>
                  <html:div class="guide-panel-buttons">
                      <button id="prev-button" class="guide-panel-button" hidden="true"></button>
                      <button id="next-button" class="guide-panel-button" hidden="true"></button>
                      <button id="close-button" class="guide-panel-button" hidden="true"></button>
                  </html:div>
              </html:div>
          </html:div>
          <html:style>
              .guide-panel {
                  background-color: var(--material-menu);
                  color: var(--fill-primary);
              }
              .guide-panel-content {
                  display: flex;
                  flex-direction: column;
                  padding: 0;
              }
              .guide-panel-header {
                  font-size: 1.2em;
                  font-weight: bold;
                  margin-bottom: 10px;
              }
              .guide-panel-header:empty {
                display: none;
              }
              .guide-panel-body {
                  align-items: center;
                  display: flex;
                  flex-direction: column;
                  white-space: pre-wrap;
              }
              .guide-panel-body:empty {
                display: none;
              }
              .guide-panel-footer {
                  display: flex;
                  flex-direction: row;
                  align-items: center;
                  justify-content: space-between;
                  margin-top: 10px;
              }
              .guide-panel-progress {
                  font-size: 0.8em;
              }
              .guide-panel-buttons {
                  display: flex;
                  flex-direction: row;
                  flex-grow: 1;
                  justify-content: flex-end;
              }
          </html:style>
      </panel>
  `);
    }
    get currentStep() {
      if (!this._steps)
        return void 0;
      return this._steps[this._currentIndex];
    }
    get currentTarget() {
      const step = this.currentStep;
      if (!step?.element)
        return void 0;
      let elem;
      if (typeof step.element === "function") {
        elem = step.element();
      } else if (typeof step.element === "string") {
        elem = this._window.document.querySelector(step.element);
      } else if (!step.element) {
        elem = this._window.document.documentElement || void 0;
      } else {
        elem = step.element;
      }
      return elem;
    }
    get hasNext() {
      return this._steps && this._currentIndex < this._steps.length - 1;
    }
    get hasPrevious() {
      return this._steps && this._currentIndex > 0;
    }
    get hookProps() {
      return {
        config: this.currentStep,
        state: {
          step: this._currentIndex,
          steps: this._steps,
          controller: this
        }
      };
    }
    get panel() {
      return this._panel;
    }
    constructor(win) {
      this._window = win;
      this._noClose = false;
      this._closed = false;
      this._autoNext = true;
      this._currentIndex = 0;
      const doc = win.document;
      const content = this.content;
      if (content) {
        doc.documentElement?.append(doc.importNode(content, true));
      }
      this._panel = doc.querySelector(`#${this._id}`);
      this._header = this._panel.querySelector(".guide-panel-header");
      this._body = this._panel.querySelector(".guide-panel-body");
      this._footer = this._panel.querySelector(".guide-panel-footer");
      this._progress = this._panel.querySelector(".guide-panel-progress");
      this._closeButton = this._panel.querySelector("#close-button");
      this._prevButton = this._panel.querySelector("#prev-button");
      this._nextButton = this._panel.querySelector("#next-button");
      this._closeButton.addEventListener("click", async () => {
        if (this.currentStep?.onCloseClick) {
          await this.currentStep.onCloseClick(this.hookProps);
        }
        this.abort();
      });
      this._prevButton.addEventListener("click", async () => {
        if (this.currentStep?.onPrevClick) {
          await this.currentStep.onPrevClick(this.hookProps);
        }
        this.movePrevious();
      });
      this._nextButton.addEventListener("click", async () => {
        if (this.currentStep?.onNextClick) {
          await this.currentStep.onNextClick(this.hookProps);
        }
        this.moveNext();
      });
      this._panel.addEventListener("popupshown", this._handleShown.bind(this));
      this._panel.addEventListener("popuphidden", this._handleHidden.bind(this));
      this._window.addEventListener("resize", this._centerPanel);
    }
    async show(steps) {
      if (steps) {
        this._steps = steps;
        this._currentIndex = 0;
      }
      const index = this._currentIndex;
      this._noClose = false;
      this._closed = false;
      this._autoNext = true;
      const step = this.currentStep;
      if (!step)
        return;
      const elem = this.currentTarget;
      if (step.onBeforeRender) {
        await step.onBeforeRender(this.hookProps);
        if (index !== this._currentIndex) {
          await this.show();
          return;
        }
      }
      if (step.onMask) {
        step.onMask({ mask: (_e) => this._createMask(_e) });
      } else {
        this._createMask(elem);
      }
      let x;
      let y = 0;
      let position = step.position || "after_start";
      if (position === "center") {
        position = "overlap";
        x = this._window.innerWidth / 2;
        y = this._window.innerHeight / 2;
      }
      this._panel.openPopup(elem, step.position || "after_start", x, y, false, false);
    }
    hide() {
      this._panel.hidePopup();
    }
    abort() {
      this._closed = true;
      this.hide();
      this._steps = void 0;
    }
    moveTo(stepIndex) {
      if (!this._steps) {
        this.hide();
        return;
      }
      if (stepIndex < 0)
        stepIndex = 0;
      if (!this._steps[stepIndex]) {
        this._currentIndex = this._steps.length;
        this.hide();
        return;
      }
      this._autoNext = false;
      this._noClose = true;
      this.hide();
      this._noClose = false;
      this._autoNext = true;
      this._currentIndex = stepIndex;
      this.show();
    }
    moveNext() {
      this.moveTo(this._currentIndex + 1);
    }
    movePrevious() {
      this.moveTo(this._currentIndex - 1);
    }
    _handleShown() {
      if (!this._steps)
        return;
      const step = this.currentStep;
      if (!step)
        return;
      this._header.innerHTML = step.title || "";
      this._body.innerHTML = step.description || "";
      this._panel.querySelectorAll(".guide-panel-button").forEach((elem) => {
        elem.hidden = true;
        elem.disabled = false;
      });
      let showButtons = step.showButtons;
      if (!showButtons) {
        showButtons = [];
        if (this.hasPrevious) {
          showButtons.push("prev");
        }
        if (this.hasNext) {
          showButtons.push("next");
        } else {
          showButtons.push("close");
        }
      }
      if (showButtons?.length) {
        showButtons.forEach((btn) => {
          this._panel.querySelector(`#${btn}-button`).hidden = false;
        });
      }
      if (step.disableButtons) {
        step.disableButtons.forEach((btn) => {
          this._panel.querySelector(`#${btn}-button`).disabled = true;
        });
      }
      if (step.showProgress) {
        this._progress.hidden = false;
        this._progress.textContent = step.progressText || `${this._currentIndex + 1}/${this._steps.length}`;
      } else {
        this._progress.hidden = true;
      }
      this._closeButton.label = step.closeBtnText || "Done";
      this._nextButton.label = step.nextBtnText || "Next";
      this._prevButton.label = step.prevBtnText || "Previous";
      if (step.onRender) {
        step.onRender(this.hookProps);
      }
      if (step.position === "center") {
        this._centerPanel();
        this._window.setTimeout(this._centerPanel, 10);
      }
    }
    async _handleHidden() {
      this._removeMask();
      this._header.innerHTML = "";
      this._body.innerHTML = "";
      this._progress.textContent = "";
      if (!this._steps)
        return;
      const step = this.currentStep;
      if (step && step.onExit) {
        await step.onExit(this.hookProps);
      }
      if (!this._noClose && (this._closed || !this.hasNext)) {
        this._panel.dispatchEvent(new this._window.CustomEvent("guide-finished"));
        this._panel.remove();
        this._window.removeEventListener("resize", this._centerPanel);
        return;
      }
      if (this._autoNext) {
        this.moveNext();
      }
    }
    _centerPanel = () => {
      const win = this._window;
      this._panel.moveTo(win.screenX + win.innerWidth / 2 - this._panel.clientWidth / 2, win.screenY + win.innerHeight / 2 - this._panel.clientHeight / 2);
    };
    _createMask(targetElement) {
      const doc = targetElement?.ownerDocument || this._window.document;
      const NS = "http://www.w3.org/2000/svg";
      const svg = doc.createElementNS(NS, "svg");
      svg.id = "guide-panel-mask";
      svg.style.position = "fixed";
      svg.style.top = "0";
      svg.style.left = "0";
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.zIndex = "9999";
      const mask = doc.createElementNS(NS, "mask");
      mask.id = "mask";
      const fullRect = doc.createElementNS(NS, "rect");
      fullRect.setAttribute("x", "0");
      fullRect.setAttribute("y", "0");
      fullRect.setAttribute("width", "100%");
      fullRect.setAttribute("height", "100%");
      fullRect.setAttribute("fill", "white");
      mask.appendChild(fullRect);
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const targetRect = doc.createElementNS(NS, "rect");
        targetRect.setAttribute("x", rect.left.toString());
        targetRect.setAttribute("y", rect.top.toString());
        targetRect.setAttribute("width", rect.width.toString());
        targetRect.setAttribute("height", rect.height.toString());
        targetRect.setAttribute("fill", "black");
        mask.appendChild(targetRect);
      }
      const maskedRect = doc.createElementNS(NS, "rect");
      maskedRect.setAttribute("x", "0");
      maskedRect.setAttribute("y", "0");
      maskedRect.setAttribute("width", "100%");
      maskedRect.setAttribute("height", "100%");
      maskedRect.setAttribute("mask", "url(#mask)");
      maskedRect.setAttribute("opacity", "0.7");
      svg.appendChild(mask);
      svg.appendChild(maskedRect);
      this._cachedMasks.push(new WeakRef(svg));
      doc.documentElement?.appendChild(svg);
    }
    _removeMask() {
      this._cachedMasks.forEach((ref) => {
        const mask = ref.deref();
        if (mask) {
          mask.remove();
        }
      });
      this._cachedMasks = [];
    }
  };

  // node_modules/zotero-plugin-toolkit/dist/helpers/largePref.js
  var LargePrefHelper = class extends BasicTool {
    keyPref;
    valuePrefPrefix;
    innerObj;
    hooks;
    /**
     *
     * @param keyPref The preference name for storing the keys of the data.
     * @param valuePrefPrefix The preference name prefix for storing the values of the data.
     * @param hooks Hooks for parsing the values of the data.
     * - `afterGetValue`: A function that takes the value of the data as input and returns the parsed value.
     * - `beforeSetValue`: A function that takes the key and value of the data as input and returns the parsed key and value.
     * If `hooks` is `"default"`, no parsing will be done.
     * If `hooks` is `"parser"`, the values will be parsed as JSON.
     * If `hooks` is an object, the values will be parsed by the hooks.
     */
    constructor(keyPref, valuePrefPrefix, hooks = "default") {
      super();
      this.keyPref = keyPref;
      this.valuePrefPrefix = valuePrefPrefix;
      if (hooks === "default") {
        this.hooks = defaultHooks;
      } else if (hooks === "parser") {
        this.hooks = parserHooks;
      } else {
        this.hooks = { ...defaultHooks, ...hooks };
      }
      this.innerObj = {};
    }
    /**
     * Get the object that stores the data.
     * @returns The object that stores the data.
     */
    asObject() {
      return this.constructTempObj();
    }
    /**
     * Get the Map that stores the data.
     * @returns The Map that stores the data.
     */
    asMapLike() {
      const mapLike = {
        get: (key) => this.getValue(key),
        set: (key, value) => {
          this.setValue(key, value);
          return mapLike;
        },
        has: (key) => this.hasKey(key),
        delete: (key) => this.deleteKey(key),
        clear: () => {
          for (const key of this.getKeys()) {
            this.deleteKey(key);
          }
        },
        forEach: (callback) => {
          return this.constructTempMap().forEach(callback);
        },
        get size() {
          return this._this.getKeys().length;
        },
        entries: () => {
          return this.constructTempMap().values();
        },
        keys: () => {
          const keys = this.getKeys();
          return keys[Symbol.iterator]();
        },
        values: () => {
          return this.constructTempMap().values();
        },
        [Symbol.iterator]: () => {
          return this.constructTempMap()[Symbol.iterator]();
        },
        [Symbol.toStringTag]: "MapLike",
        _this: this
      };
      return mapLike;
    }
    /**
     * Get the keys of the data.
     * @returns The keys of the data.
     */
    getKeys() {
      const rawKeys = Zotero.Prefs.get(this.keyPref, true);
      const keys = rawKeys ? JSON.parse(rawKeys) : [];
      for (const key of keys) {
        const value = "placeholder";
        this.innerObj[key] = value;
      }
      return keys;
    }
    /**
     * Set the keys of the data.
     * @param keys The keys of the data.
     */
    setKeys(keys) {
      keys = [...new Set(keys.filter((key) => key))];
      Zotero.Prefs.set(this.keyPref, JSON.stringify(keys), true);
      for (const key of keys) {
        const value = "placeholder";
        this.innerObj[key] = value;
      }
    }
    /**
     * Get the value of a key.
     * @param key The key of the data.
     * @returns The value of the key.
     */
    getValue(key) {
      const value = Zotero.Prefs.get(`${this.valuePrefPrefix}${key}`, true);
      if (typeof value === "undefined") {
        return;
      }
      const { value: newValue } = this.hooks.afterGetValue({ value });
      this.innerObj[key] = newValue;
      return newValue;
    }
    /**
     * Set the value of a key.
     * @param key The key of the data.
     * @param value The value of the key.
     */
    setValue(key, value) {
      const { key: newKey, value: newValue } = this.hooks.beforeSetValue({
        key,
        value
      });
      this.setKey(newKey);
      Zotero.Prefs.set(`${this.valuePrefPrefix}${newKey}`, newValue, true);
      this.innerObj[newKey] = newValue;
    }
    /**
     * Check if a key exists.
     * @param key The key of the data.
     * @returns Whether the key exists.
     */
    hasKey(key) {
      return this.getKeys().includes(key);
    }
    /**
     * Add a key.
     * @param key The key of the data.
     */
    setKey(key) {
      const keys = this.getKeys();
      if (!keys.includes(key)) {
        keys.push(key);
        this.setKeys(keys);
      }
    }
    /**
     * Delete a key.
     * @param key The key of the data.
     */
    deleteKey(key) {
      const keys = this.getKeys();
      const index = keys.indexOf(key);
      if (index > -1) {
        keys.splice(index, 1);
        delete this.innerObj[key];
        this.setKeys(keys);
      }
      Zotero.Prefs.clear(`${this.valuePrefPrefix}${key}`, true);
      return true;
    }
    constructTempObj() {
      return new Proxy(this.innerObj, {
        get: (target, prop, receiver) => {
          this.getKeys();
          if (typeof prop === "string" && prop in target) {
            this.getValue(prop);
          }
          return Reflect.get(target, prop, receiver);
        },
        set: (target, p, newValue, receiver) => {
          if (typeof p === "string") {
            if (newValue === void 0) {
              this.deleteKey(p);
              return true;
            }
            this.setValue(p, newValue);
            return true;
          }
          return Reflect.set(target, p, newValue, receiver);
        },
        has: (target, p) => {
          this.getKeys();
          return Reflect.has(target, p);
        },
        deleteProperty: (target, p) => {
          if (typeof p === "string") {
            this.deleteKey(p);
            return true;
          }
          return Reflect.deleteProperty(target, p);
        }
      });
    }
    constructTempMap() {
      const map = /* @__PURE__ */ new Map();
      for (const key of this.getKeys()) {
        map.set(key, this.getValue(key));
      }
      return map;
    }
  };
  var defaultHooks = {
    afterGetValue: ({ value }) => ({ value }),
    beforeSetValue: ({ key, value }) => ({ key, value })
  };
  var parserHooks = {
    afterGetValue: ({ value }) => {
      try {
        value = JSON.parse(value);
      } catch {
        return { value };
      }
      return { value };
    },
    beforeSetValue: ({ key, value }) => {
      value = JSON.stringify(value);
      return { key, value };
    }
  };

  // node_modules/zotero-plugin-toolkit/dist/helpers/patch.js
  var PatchHelper = class extends BasicTool {
    options;
    constructor() {
      super();
      this.options = void 0;
    }
    setData(options) {
      this.options = options;
      const Zotero2 = this.getGlobal("Zotero");
      const { target, funcSign, patcher } = options;
      const origin = target[funcSign];
      this.log("patching ", funcSign);
      target[funcSign] = function(...args) {
        if (options.enabled)
          try {
            return patcher(origin).apply(this, args);
          } catch (e) {
            Zotero2.logError(e);
          }
        return origin.apply(this, args);
      };
      return this;
    }
    enable() {
      if (!this.options)
        throw new Error("No patch data set");
      this.options.enabled = true;
      return this;
    }
    disable() {
      if (!this.options)
        throw new Error("No patch data set");
      this.options.enabled = false;
      return this;
    }
  };

  // node_modules/zotero-plugin-toolkit/dist/helpers/progressWindow.js
  var icons = {
    success: "chrome://zotero/skin/tick.png",
    fail: "chrome://zotero/skin/cross.png"
  };
  var ProgressWindowHelper = class {
    win;
    lines;
    closeTime;
    /**
     *
     * @param header window header
     * @param options
     * @param options.window
     * @param options.closeOnClick
     * @param options.closeTime
     * @param options.closeOtherProgressWindows
     */
    constructor(header, options = {
      closeOnClick: true,
      closeTime: 5e3
    }) {
      this.win = new (BasicTool.getZotero()).ProgressWindow(options);
      this.lines = [];
      this.closeTime = options.closeTime || 5e3;
      this.win.changeHeadline(header);
      if (options.closeOtherProgressWindows) {
        BasicTool.getZotero().ProgressWindowSet.closeAll();
      }
    }
    /**
     * Create a new line
     * @param options
     * @param options.type
     * @param options.icon
     * @param options.text
     * @param options.progress
     * @param options.idx
     */
    createLine(options) {
      const icon = this.getIcon(options.type, options.icon);
      const line = new this.win.ItemProgress(icon || "", options.text || "");
      if (typeof options.progress === "number") {
        line.setProgress(options.progress);
      }
      this.lines.push(line);
      this.updateIcons();
      return this;
    }
    /**
     * Change the line content
     * @param options
     * @param options.type
     * @param options.icon
     * @param options.text
     * @param options.progress
     * @param options.idx
     */
    changeLine(options) {
      if (this.lines?.length === 0) {
        return this;
      }
      const idx = typeof options.idx !== "undefined" && options.idx >= 0 && options.idx < this.lines.length ? options.idx : 0;
      const icon = this.getIcon(options.type, options.icon);
      if (icon) {
        this.lines[idx].setItemTypeAndIcon(icon);
      }
      options.text && this.lines[idx].setText(options.text);
      typeof options.progress === "number" && this.lines[idx].setProgress(options.progress);
      this.updateIcons();
      return this;
    }
    show(closeTime = void 0) {
      this.win.show();
      typeof closeTime !== "undefined" && (this.closeTime = closeTime);
      if (this.closeTime && this.closeTime > 0) {
        this.win.startCloseTimer(this.closeTime);
      }
      setTimeout(this.updateIcons.bind(this), 50);
      return this;
    }
    /**
     * Set custom icon uri for progress window
     * @param key
     * @param uri
     */
    static setIconURI(key, uri) {
      icons[key] = uri;
    }
    getIcon(type, defaultIcon) {
      return type && type in icons ? icons[type] : defaultIcon;
    }
    updateIcons() {
      try {
        this.lines.forEach((line) => {
          const box = line._image;
          const icon = box.dataset.itemType;
          if (icon && !box.style.backgroundImage.includes("progress_arcs")) {
            box.style.backgroundImage = `url(${box.dataset.itemType})`;
          }
        });
      } catch {
      }
    }
    changeHeadline(text, icon, postText) {
      this.win.changeHeadline(text, icon, postText);
      return this;
    }
    addLines(labels, icons2) {
      this.win.addLines(labels, icons2);
      return this;
    }
    addDescription(text) {
      this.win.addDescription(text);
      return this;
    }
    startCloseTimer(ms, requireMouseOver) {
      this.win.startCloseTimer(ms, requireMouseOver);
      return this;
    }
    close() {
      this.win.close();
      return this;
    }
  };

  // node_modules/zotero-plugin-toolkit/dist/helpers/virtualizedTable.js
  var VirtualizedTableHelper = class extends BasicTool {
    props;
    localeStrings;
    containerId;
    treeInstance;
    window;
    React;
    ReactDOM;
    VirtualizedTable;
    IntlProvider;
    constructor(win) {
      super();
      this.window = win;
      const Zotero2 = this.getGlobal("Zotero");
      const _require = win.require;
      this.React = _require("react");
      this.ReactDOM = _require("react-dom");
      this.VirtualizedTable = _require("components/virtualized-table");
      this.IntlProvider = _require("react-intl").IntlProvider;
      this.props = {
        id: `vtable-${Zotero2.Utilities.randomString()}-${(/* @__PURE__ */ new Date()).getTime()}`,
        getRowCount: () => 0
      };
      this.localeStrings = Zotero2.Intl.strings;
    }
    setProp(...args) {
      if (args.length === 1) {
        Object.assign(this.props, args[0]);
      } else if (args.length === 2) {
        this.props[args[0]] = args[1];
      }
      return this;
    }
    /**
     * Set locale strings, which replaces the table header's label if matches. Default it's `Zotero.Intl.strings`
     * @param localeStrings
     */
    setLocale(localeStrings) {
      Object.assign(this.localeStrings, localeStrings);
      return this;
    }
    /**
     * Set container element id that the table will be rendered on.
     * @param id element id
     */
    setContainerId(id) {
      this.containerId = id;
      return this;
    }
    /**
     * Render the table.
     * @param selectId Which row to select after rendering
     * @param onfulfilled callback after successfully rendered
     * @param onrejected callback after rendering with error
     */
    render(selectId, onfulfilled, onrejected) {
      const refreshSelection = () => {
        this.treeInstance.invalidate();
        if (typeof selectId !== "undefined" && selectId >= 0) {
          this.treeInstance.selection.select(selectId);
        } else {
          this.treeInstance.selection.clearSelection();
        }
      };
      if (!this.treeInstance) {
        new Promise((resolve) => {
          const vtableProps = Object.assign({}, this.props, {
            ref: (ref) => {
              this.treeInstance = ref;
              resolve(void 0);
            }
          });
          if (vtableProps.getRowData && !vtableProps.renderItem) {
            Object.assign(vtableProps, {
              renderItem: this.VirtualizedTable.makeRowRenderer(vtableProps.getRowData)
            });
          }
          const elem = this.React.createElement(this.IntlProvider, { locale: Zotero.locale, messages: Zotero.Intl.strings }, this.React.createElement(this.VirtualizedTable, vtableProps));
          const container = this.window.document.getElementById(this.containerId);
          this.ReactDOM.createRoot(container).render(elem);
        }).then(() => {
          this.getGlobal("setTimeout")(() => {
            refreshSelection();
          });
        }).then(onfulfilled, onrejected);
      } else {
        refreshSelection();
      }
      return this;
    }
  };

  // node_modules/zotero-plugin-toolkit/dist/managers/fieldHook.js
  var FieldHookManager = class extends ManagerTool {
    data = {
      getField: {},
      setField: {},
      isFieldOfBase: {}
    };
    patchHelpers = {
      getField: new PatchHelper(),
      setField: new PatchHelper(),
      isFieldOfBase: new PatchHelper()
    };
    constructor(base) {
      super(base);
      const _thisHelper = this;
      for (const type of Object.keys(this.patchHelpers)) {
        const helper = this.patchHelpers[type];
        helper.setData({
          target: this.getGlobal("Zotero").Item.prototype,
          funcSign: type,
          patcher: (original) => function(field, ...args) {
            const originalThis = this;
            const handler = _thisHelper.data[type][field];
            if (typeof handler === "function") {
              try {
                return handler(field, args[0], args[1], originalThis, original);
              } catch (e) {
                return field + String(e);
              }
            }
            return original.apply(originalThis, [field, ...args]);
          },
          enabled: true
        });
      }
    }
    register(type, field, hook) {
      this.data[type][field] = hook;
    }
    unregister(type, field) {
      delete this.data[type][field];
    }
    unregisterAll() {
      this.data.getField = {};
      this.data.setField = {};
      this.data.isFieldOfBase = {};
      this.patchHelpers.getField.disable();
      this.patchHelpers.setField.disable();
      this.patchHelpers.isFieldOfBase.disable();
    }
  };

  // node_modules/zotero-plugin-toolkit/dist/utils/wait.js
  var basicTool = new BasicTool();
  function waitUntil(condition, callback, interval = 100, timeout = 1e4) {
    const start = Date.now();
    const intervalId = basicTool.getGlobal("setInterval")(() => {
      if (condition()) {
        basicTool.getGlobal("clearInterval")(intervalId);
        callback();
      } else if (Date.now() - start > timeout) {
        basicTool.getGlobal("clearInterval")(intervalId);
      }
    }, interval);
  }
  var waitUtilAsync = waitUntilAsync;
  function waitUntilAsync(condition, interval = 100, timeout = 1e4) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const intervalId = basicTool.getGlobal("setInterval")(() => {
        if (condition()) {
          basicTool.getGlobal("clearInterval")(intervalId);
          resolve();
        } else if (Date.now() - start > timeout) {
          basicTool.getGlobal("clearInterval")(intervalId);
          reject(new Error("timeout"));
        }
      }, interval);
    });
  }
  async function waitForReader(reader) {
    await reader._initPromise;
    await reader._lastView.initializedPromise;
    if (reader.type === "pdf")
      await reader._lastView._iframeWindow.PDFViewerApplication.initializedPromise;
  }

  // node_modules/zotero-plugin-toolkit/dist/managers/keyboard.js
  var KeyboardManager = class extends ManagerTool {
    _keyboardCallbacks = /* @__PURE__ */ new Set();
    _cachedKey;
    id;
    constructor(base) {
      super(base);
      this.id = `kbd-${Zotero.Utilities.randomString()}`;
      this._ensureAutoUnregisterAll();
      this.addListenerCallback("onMainWindowLoad", this.initKeyboardListener);
      this.addListenerCallback("onMainWindowUnload", this.unInitKeyboardListener);
      this.initReaderKeyboardListener();
      for (const win of Zotero.getMainWindows()) {
        this.initKeyboardListener(win);
      }
    }
    /**
     * Register a keyboard event listener.
     * @param callback The callback function.
     */
    register(callback) {
      this._keyboardCallbacks.add(callback);
    }
    /**
     * Unregister a keyboard event listener.
     * @param callback The callback function.
     */
    unregister(callback) {
      this._keyboardCallbacks.delete(callback);
    }
    /**
     * Unregister all keyboard event listeners.
     */
    unregisterAll() {
      this._keyboardCallbacks.clear();
      this.removeListenerCallback("onMainWindowLoad", this.initKeyboardListener);
      this.removeListenerCallback("onMainWindowUnload", this.unInitKeyboardListener);
      for (const win of Zotero.getMainWindows()) {
        this.unInitKeyboardListener(win);
      }
    }
    initKeyboardListener = this._initKeyboardListener.bind(this);
    unInitKeyboardListener = this._unInitKeyboardListener.bind(this);
    initReaderKeyboardListener() {
      Zotero.Reader.registerEventListener("renderToolbar", (event) => this.addReaderKeyboardCallback(event), this._basicOptions.api.pluginID);
      Zotero.Reader._readers.forEach((reader) => this.addReaderKeyboardCallback({ reader }));
    }
    async addReaderKeyboardCallback(event) {
      const reader = event.reader;
      const initializedKey = `_ztoolkitKeyboard${this.id}Initialized`;
      await waitForReader(reader);
      if (!reader._iframeWindow) {
        return;
      }
      if (reader._iframeWindow[initializedKey]) {
        return;
      }
      this._initKeyboardListener(reader._iframeWindow);
      waitUntil(() => !Components.utils.isDeadWrapper(reader._internalReader) && reader._internalReader?._primaryView?._iframeWindow, () => this._initKeyboardListener(reader._internalReader._primaryView?._iframeWindow));
      reader._iframeWindow[initializedKey] = true;
    }
    _initKeyboardListener(win) {
      if (!win) {
        return;
      }
      win.addEventListener("keydown", this.triggerKeydown);
      win.addEventListener("keyup", this.triggerKeyup);
    }
    _unInitKeyboardListener(win) {
      if (!win) {
        return;
      }
      win.removeEventListener("keydown", this.triggerKeydown);
      win.removeEventListener("keyup", this.triggerKeyup);
    }
    triggerKeydown = (e) => {
      if (!this._cachedKey) {
        this._cachedKey = new KeyModifier(e);
      } else {
        this._cachedKey.merge(new KeyModifier(e), { allowOverwrite: false });
      }
      this.dispatchCallback(e, {
        type: "keydown"
      });
    };
    triggerKeyup = async (e) => {
      if (!this._cachedKey) {
        return;
      }
      const currentShortcut = new KeyModifier(this._cachedKey);
      this._cachedKey = void 0;
      this.dispatchCallback(e, {
        keyboard: currentShortcut,
        type: "keyup"
      });
    };
    dispatchCallback(...args) {
      this._keyboardCallbacks.forEach((cbk) => cbk(...args));
    }
  };
  var KeyModifier = class _KeyModifier {
    accel = false;
    shift = false;
    control = false;
    meta = false;
    alt = false;
    key = "";
    useAccel = false;
    constructor(raw, options) {
      this.useAccel = options?.useAccel || false;
      if (typeof raw === "undefined") {
      } else if (typeof raw === "string") {
        raw = raw || "";
        raw = this.unLocalized(raw);
        this.accel = raw.includes("accel");
        this.shift = raw.includes("shift");
        this.control = raw.includes("control");
        this.meta = raw.includes("meta");
        this.alt = raw.includes("alt");
        this.key = raw.replace(/(accel|shift|control|meta|alt|[ ,\-])/g, "").toLocaleLowerCase();
      } else if (raw instanceof _KeyModifier) {
        this.merge(raw, { allowOverwrite: true });
      } else {
        if (options?.useAccel) {
          if (Zotero.isMac) {
            this.accel = raw.metaKey;
          } else {
            this.accel = raw.ctrlKey;
          }
        }
        this.shift = raw.shiftKey;
        this.control = raw.ctrlKey;
        this.meta = raw.metaKey;
        this.alt = raw.altKey;
        if (!["Shift", "Meta", "Ctrl", "Alt", "Control"].includes(raw.key)) {
          this.key = raw.key;
        }
      }
    }
    /**
     * Merge another KeyModifier into this one.
     * @param newMod the new KeyModifier
     * @param options
     * @param options.allowOverwrite
     * @returns KeyModifier
     */
    merge(newMod, options) {
      const allowOverwrite = options?.allowOverwrite || false;
      this.mergeAttribute("accel", newMod.accel, allowOverwrite);
      this.mergeAttribute("shift", newMod.shift, allowOverwrite);
      this.mergeAttribute("control", newMod.control, allowOverwrite);
      this.mergeAttribute("meta", newMod.meta, allowOverwrite);
      this.mergeAttribute("alt", newMod.alt, allowOverwrite);
      this.mergeAttribute("key", newMod.key, allowOverwrite);
      return this;
    }
    /**
     * Check if the current KeyModifier equals to another KeyModifier.
     * @param newMod the new KeyModifier
     * @returns true if equals
     */
    equals(newMod) {
      if (typeof newMod === "string") {
        newMod = new _KeyModifier(newMod);
      }
      if (this.shift !== newMod.shift || this.alt !== newMod.alt || this.key.toLowerCase() !== newMod.key.toLowerCase()) {
        return false;
      }
      if (this.accel || newMod.accel) {
        if (Zotero.isMac) {
          if ((this.accel || this.meta) !== (newMod.accel || newMod.meta) || this.control !== newMod.control) {
            return false;
          }
        } else {
          if ((this.accel || this.control) !== (newMod.accel || newMod.control) || this.meta !== newMod.meta) {
            return false;
          }
        }
      } else {
        if (this.control !== newMod.control || this.meta !== newMod.meta) {
          return false;
        }
      }
      return true;
    }
    /**
     * Get the raw string representation of the KeyModifier.
     */
    getRaw() {
      const enabled = [];
      this.accel && enabled.push("accel");
      this.shift && enabled.push("shift");
      this.control && enabled.push("control");
      this.meta && enabled.push("meta");
      this.alt && enabled.push("alt");
      this.key && enabled.push(this.key);
      return enabled.join(",");
    }
    /**
     * Get the localized string representation of the KeyModifier.
     */
    getLocalized() {
      const raw = this.getRaw();
      if (Zotero.isMac) {
        return raw.replaceAll("control", "\u2303").replaceAll("alt", "\u2325").replaceAll("shift", "\u21E7").replaceAll("meta", "\u2318");
      } else {
        return raw.replaceAll("control", "Ctrl").replaceAll("alt", "Alt").replaceAll("shift", "Shift").replaceAll("meta", "Win");
      }
    }
    /**
     * Get the un-localized string representation of the KeyModifier.
     */
    unLocalized(raw) {
      if (Zotero.isMac) {
        return raw.replaceAll("\u2303", "control").replaceAll("\u2325", "alt").replaceAll("\u21E7", "shift").replaceAll("\u2318", "meta");
      } else {
        return raw.replaceAll("Ctrl", "control").replaceAll("Alt", "alt").replaceAll("Shift", "shift").replaceAll("Win", "meta");
      }
    }
    mergeAttribute(attribute, value, allowOverwrite) {
      if (allowOverwrite || !this[attribute]) {
        this[attribute] = value;
      }
    }
  };

  // node_modules/zotero-plugin-toolkit/dist/managers/menu.js
  var MenuManager = class extends ManagerTool {
    ui;
    constructor(base) {
      super(base);
      this.ui = new UITool(this);
    }
    /**
     * Insert an menu item/menu(with popup)/menuseprator into a menupopup
     * @remarks
     * options:
     * ```ts
     * export interface MenuitemOptions {
     *   tag: "menuitem" | "menu" | "menuseparator";
     *   id?: string;
     *   label?: string;
     *   // data url (chrome://xxx.png) or base64 url (data:image/png;base64,xxx)
     *   icon?: string;
     *   class?: string;
     *   styles?: { [key: string]: string };
     *   hidden?: boolean;
     *   disabled?: boolean;
     *   oncommand?: string;
     *   commandListener?: EventListenerOrEventListenerObject;
     *   // Attributes below are used when type === "menu"
     *   popupId?: string;
     *   onpopupshowing?: string;
     *   subElementOptions?: Array<MenuitemOptions>;
     * }
     * ```
     * @param menuPopup
     * @param options
     * @param insertPosition
     * @param anchorElement The menuitem will be put before/after `anchorElement`. If not set, put at start/end of the menupopup.
     * @example
     * Insert menuitem with icon into item menupopup
     * ```ts
     * // base64 or chrome:// url
     * const menuIcon = "chrome://addontemplate/content/icons/favicon@0.5x.png";
     * ztoolkit.Menu.register("item", {
     *   tag: "menuitem",
     *   id: "zotero-itemmenu-addontemplate-test",
     *   label: "Addon Template: Menuitem",
     *   oncommand: "alert('Hello World! Default Menuitem.')",
     *   icon: menuIcon,
     * });
     * ```
     * @example
     * Insert menu into file menupopup
     * ```ts
     * ztoolkit.Menu.register(
     *   "menuFile",
     *   {
     *     tag: "menu",
     *     label: "Addon Template: Menupopup",
     *     subElementOptions: [
     *       {
     *         tag: "menuitem",
     *         label: "Addon Template",
     *         oncommand: "alert('Hello World! Sub Menuitem.')",
     *       },
     *     ],
     *   },
     *   "before",
     *   Zotero.getMainWindow().document.querySelector(
     *     "#zotero-itemmenu-addontemplate-test"
     *   )
     * );
     * ```
     */
    register(menuPopup, options, insertPosition = "after", anchorElement) {
      let popup;
      if (typeof menuPopup === "string") {
        popup = this.getGlobal("document").querySelector(MenuSelector[menuPopup]);
      } else {
        popup = menuPopup;
      }
      if (!popup) {
        return false;
      }
      const doc = popup.ownerDocument;
      const genMenuElement = (menuitemOption) => {
        const elementOption = {
          tag: menuitemOption.tag,
          id: menuitemOption.id,
          namespace: "xul",
          attributes: {
            label: menuitemOption.label || "",
            hidden: Boolean(menuitemOption.hidden),
            disabled: Boolean(menuitemOption.disabled),
            class: menuitemOption.class || "",
            oncommand: menuitemOption.oncommand || ""
          },
          classList: menuitemOption.classList,
          styles: menuitemOption.styles || {},
          listeners: [],
          children: []
        };
        if (menuitemOption.icon) {
          if (!this.getGlobal("Zotero").isMac) {
            if (menuitemOption.tag === "menu") {
              elementOption.attributes.class += " menu-iconic";
            } else {
              elementOption.attributes.class += " menuitem-iconic";
            }
          }
          elementOption.styles["list-style-image"] = `url(${menuitemOption.icon})`;
        }
        if (menuitemOption.commandListener) {
          elementOption.listeners?.push({
            type: "command",
            listener: menuitemOption.commandListener
          });
        }
        if (menuitemOption.tag === "menuitem") {
          elementOption.attributes.type = menuitemOption.type || "";
          elementOption.attributes.checked = menuitemOption.checked || false;
        }
        const menuItem = this.ui.createElement(doc, menuitemOption.tag, elementOption);
        if (menuitemOption.isHidden || menuitemOption.getVisibility) {
          popup?.addEventListener("popupshowing", (ev) => {
            let hidden;
            if (menuitemOption.isHidden) {
              hidden = menuitemOption.isHidden(menuItem, ev);
            } else if (menuitemOption.getVisibility) {
              const visible = menuitemOption.getVisibility(menuItem, ev);
              hidden = typeof visible === "undefined" ? void 0 : !visible;
            }
            if (typeof hidden === "undefined") {
              return;
            }
            if (hidden) {
              menuItem.setAttribute("hidden", "true");
            } else {
              menuItem.removeAttribute("hidden");
            }
          });
        }
        if (menuitemOption.isDisabled) {
          popup?.addEventListener("popupshowing", (ev) => {
            const disabled = menuitemOption.isDisabled(menuItem, ev);
            if (typeof disabled === "undefined") {
              return;
            }
            if (disabled) {
              menuItem.setAttribute("disabled", "true");
            } else {
              menuItem.removeAttribute("disabled");
            }
          });
        }
        if ((menuitemOption.tag === "menuitem" || menuitemOption.tag === "menuseparator") && menuitemOption.onShowing) {
          popup?.addEventListener("popupshowing", (ev) => {
            menuitemOption.onShowing(menuItem, ev);
          });
        }
        if (menuitemOption.tag === "menu") {
          const subPopup = this.ui.createElement(doc, "menupopup", {
            id: menuitemOption.popupId,
            attributes: { onpopupshowing: menuitemOption.onpopupshowing || "" }
          });
          menuitemOption.children?.forEach((childOption) => {
            subPopup.append(genMenuElement(childOption));
          });
          menuItem.append(subPopup);
        }
        return menuItem;
      };
      const topMenuItem = genMenuElement(options);
      if (popup.childElementCount) {
        if (!anchorElement) {
          anchorElement = insertPosition === "after" ? popup.lastElementChild : popup.firstElementChild;
        }
        anchorElement[insertPosition](topMenuItem);
      } else {
        popup.appendChild(topMenuItem);
      }
    }
    unregister(menuId) {
      this.getGlobal("document").querySelector(`#${menuId}`)?.remove();
    }
    unregisterAll() {
      this.ui.unregisterAll();
    }
  };
  var MenuSelector;
  (function(MenuSelector2) {
    MenuSelector2["menuFile"] = "#menu_FilePopup";
    MenuSelector2["menuEdit"] = "#menu_EditPopup";
    MenuSelector2["menuView"] = "#menu_viewPopup";
    MenuSelector2["menuGo"] = "#menu_goPopup";
    MenuSelector2["menuTools"] = "#menu_ToolsPopup";
    MenuSelector2["menuHelp"] = "#menu_HelpPopup";
    MenuSelector2["collection"] = "#zotero-collectionmenu";
    MenuSelector2["item"] = "#zotero-itemmenu";
  })(MenuSelector || (MenuSelector = {}));

  // node_modules/zotero-plugin-toolkit/dist/managers/prompt.js
  var Prompt = class {
    ui;
    base;
    get document() {
      return this.base.getGlobal("document");
    }
    /**
     * Record the last text entered
     */
    lastInputText = "";
    /**
     * Default text
     */
    defaultText = {
      placeholder: "Select a command...",
      empty: "No commands found."
    };
    /**
     * It controls the max line number of commands displayed in `commandsNode`.
     */
    maxLineNum = 12;
    /**
     * It controls the max number of suggestions.
     */
    maxSuggestionNum = 100;
    /**
     * The top-level HTML div node of `Prompt`
     */
    promptNode;
    /**
     * The HTML input node of `Prompt`.
     */
    inputNode;
    /**
     * Save all commands registered by all addons.
     */
    commands = [];
    /**
     * Initialize `Prompt` but do not create UI.
     */
    constructor() {
      this.base = new BasicTool();
      this.ui = new UITool();
      this.initializeUI();
    }
    /**
     * Initialize `Prompt` UI and then bind events on it.
     */
    initializeUI() {
      this.addStyle();
      this.createHTML();
      this.initInputEvents();
      this.registerShortcut();
    }
    createHTML() {
      this.promptNode = this.ui.createElement(this.document, "div", {
        styles: {
          display: "none"
        },
        children: [
          {
            tag: "div",
            styles: {
              position: "fixed",
              left: "0",
              top: "0",
              backgroundColor: "transparent",
              width: "100%",
              height: "100%"
            },
            listeners: [
              {
                type: "click",
                listener: () => {
                  this.promptNode.style.display = "none";
                }
              }
            ]
          }
        ]
      });
      this.promptNode.appendChild(this.ui.createElement(this.document, "div", {
        id: `zotero-plugin-toolkit-prompt`,
        classList: ["prompt-container"],
        children: [
          {
            tag: "div",
            classList: ["input-container"],
            children: [
              {
                tag: "input",
                classList: ["prompt-input"],
                attributes: {
                  type: "text",
                  placeholder: this.defaultText.placeholder
                }
              },
              {
                tag: "div",
                classList: ["cta"]
              }
            ]
          },
          {
            tag: "div",
            classList: ["commands-containers"]
          },
          {
            tag: "div",
            classList: ["instructions"],
            children: [
              {
                tag: "div",
                classList: ["instruction"],
                children: [
                  {
                    tag: "span",
                    classList: ["key"],
                    properties: {
                      innerText: "\u2191\u2193"
                    }
                  },
                  {
                    tag: "span",
                    properties: {
                      innerText: "to navigate"
                    }
                  }
                ]
              },
              {
                tag: "div",
                classList: ["instruction"],
                children: [
                  {
                    tag: "span",
                    classList: ["key"],
                    properties: {
                      innerText: "enter"
                    }
                  },
                  {
                    tag: "span",
                    properties: {
                      innerText: "to trigger"
                    }
                  }
                ]
              },
              {
                tag: "div",
                classList: ["instruction"],
                children: [
                  {
                    tag: "span",
                    classList: ["key"],
                    properties: {
                      innerText: "esc"
                    }
                  },
                  {
                    tag: "span",
                    properties: {
                      innerText: "to exit"
                    }
                  }
                ]
              }
            ]
          }
        ]
      }));
      this.inputNode = this.promptNode.querySelector("input");
      this.document.documentElement.appendChild(this.promptNode);
    }
    /**
     * Show commands in a new `commandsContainer`
     * All other `commandsContainer` is hidden
     * @param commands Command[]
     * @param clear remove all `commandsContainer` if true
     */
    showCommands(commands, clear = false) {
      if (clear) {
        this.promptNode.querySelectorAll(".commands-container").forEach((e) => e.remove());
      }
      this.inputNode.placeholder = this.defaultText.placeholder;
      const commandsContainer = this.createCommandsContainer();
      for (const command of commands) {
        try {
          if (!command.name || command.when && !command.when()) {
            continue;
          }
        } catch {
          continue;
        }
        commandsContainer.appendChild(this.createCommandNode(command));
      }
    }
    /**
     * Create a `commandsContainer` div element, append to `commandsContainer` and hide others.
     * @returns commandsNode
     */
    createCommandsContainer() {
      const commandsContainer = this.ui.createElement(this.document, "div", {
        classList: ["commands-container"]
      });
      this.promptNode.querySelectorAll(".commands-container").forEach((e) => {
        e.style.display = "none";
      });
      this.promptNode.querySelector(".commands-containers").appendChild(commandsContainer);
      return commandsContainer;
    }
    /**
     * Return current displayed `commandsContainer`
     * @returns
     */
    getCommandsContainer() {
      return [
        ...Array.from(this.promptNode.querySelectorAll(".commands-container"))
      ].find((e) => {
        return e.style.display !== "none";
      });
    }
    /**
     * Create a command item for `Prompt` UI.
     * @param command
     * @returns
     */
    createCommandNode(command) {
      const commandNode = this.ui.createElement(this.document, "div", {
        classList: ["command"],
        children: [
          {
            tag: "div",
            classList: ["content"],
            children: [
              {
                tag: "div",
                classList: ["name"],
                children: [
                  {
                    tag: "span",
                    properties: {
                      innerText: command.name
                    }
                  }
                ]
              },
              {
                tag: "div",
                classList: ["aux"],
                children: command.label ? [
                  {
                    tag: "span",
                    classList: ["label"],
                    properties: {
                      innerText: command.label
                    }
                  }
                ] : []
              }
            ]
          }
        ],
        listeners: [
          {
            type: "mousemove",
            listener: () => {
              this.selectItem(commandNode);
            }
          },
          {
            type: "click",
            listener: async () => {
              await this.execCallback(command.callback);
            }
          }
        ]
      });
      commandNode.command = command;
      return commandNode;
    }
    /**
     * Called when `enter` key is pressed.
     */
    trigger() {
      [
        ...Array.from(this.promptNode.querySelectorAll(".commands-container"))
      ].find((e) => e.style.display !== "none").querySelector(".selected").click();
    }
    /**
     * Called when `escape` key is pressed.
     */
    exit() {
      this.inputNode.placeholder = this.defaultText.placeholder;
      if (this.promptNode.querySelectorAll(".commands-containers .commands-container").length >= 2) {
        this.promptNode.querySelector(".commands-container:last-child").remove();
        const commandsContainer = this.promptNode.querySelector(".commands-container:last-child");
        commandsContainer.style.display = "";
        commandsContainer.querySelectorAll(".commands").forEach((e) => e.style.display = "flex");
        this.inputNode.focus();
      } else {
        this.promptNode.style.display = "none";
      }
    }
    async execCallback(callback) {
      if (Array.isArray(callback)) {
        this.showCommands(callback);
      } else {
        await callback(this);
      }
    }
    /**
     * Match suggestions for user's entered text.
     */
    async showSuggestions(inputText) {
      const _w = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-./:;<=>?@[\]^_`{|}~]/;
      const jw = /\s/;
      const Ww = /[\u0F00-\u0FFF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF66-\uFF9F]/;
      function Yw(e2, t, n, i) {
        if (e2.length === 0)
          return 0;
        let r = 0;
        r -= Math.max(0, e2.length - 1), r -= i / 10;
        const o = e2[0][0];
        return r -= (e2[e2.length - 1][1] - o + 1 - t) / 100, r -= o / 1e3, r -= n / 1e4;
      }
      function $w(e2, t, n, i) {
        if (e2.length === 0)
          return null;
        for (var r = n.toLowerCase(), o = 0, a = 0, s = [], l = 0; l < e2.length; l++) {
          const c = e2[l];
          const u = r.indexOf(c, a);
          if (u === -1)
            return null;
          const h = n.charAt(u);
          if (u > 0 && !_w.test(h) && !Ww.test(h)) {
            const p = n.charAt(u - 1);
            if (h.toLowerCase() !== h && p.toLowerCase() !== p || h.toUpperCase() !== h && !_w.test(p) && !jw.test(p) && !Ww.test(p))
              if (i) {
                if (u !== a) {
                  a += c.length, l--;
                  continue;
                }
              } else
                o += 1;
          }
          if (s.length === 0)
            s.push([u, u + c.length]);
          else {
            const d = s[s.length - 1];
            d[1] < u ? s.push([u, u + c.length]) : d[1] = u + c.length;
          }
          a = u + c.length;
        }
        return {
          matches: s,
          score: Yw(s, t.length, r.length, o)
        };
      }
      function Gw(e2) {
        for (var t = e2.toLowerCase(), n = [], i = 0, r = 0; r < t.length; r++) {
          const o = t.charAt(r);
          jw.test(o) ? (i !== r && n.push(t.substring(i, r)), i = r + 1) : (_w.test(o) || Ww.test(o)) && (i !== r && n.push(t.substring(i, r)), n.push(o), i = r + 1);
        }
        return i !== t.length && n.push(t.substring(i, t.length)), {
          query: e2,
          tokens: n,
          fuzzy: t.split("")
        };
      }
      function Xw(e2, t) {
        if (e2.query === "")
          return {
            score: 0,
            matches: []
          };
        const n = $w(e2.tokens, e2.query, t, false);
        return n || $w(e2.fuzzy, e2.query, t, true);
      }
      const e = Gw(inputText);
      let container = this.getCommandsContainer();
      if (container.classList.contains("suggestions")) {
        this.exit();
      }
      if (inputText.trim() == "") {
        return true;
      }
      const suggestions = [];
      this.getCommandsContainer().querySelectorAll(".command").forEach((commandNode) => {
        const spanNode = commandNode.querySelector(".name span");
        const spanText = spanNode.innerText;
        const res = Xw(e, spanText);
        if (res) {
          commandNode = this.createCommandNode(commandNode.command);
          let spanHTML = "";
          let i = 0;
          for (let j = 0; j < res.matches.length; j++) {
            const [start, end] = res.matches[j];
            if (start > i) {
              spanHTML += spanText.slice(i, start);
            }
            spanHTML += `<span class="highlight">${spanText.slice(start, end)}</span>`;
            i = end;
          }
          if (i < spanText.length) {
            spanHTML += spanText.slice(i, spanText.length);
          }
          commandNode.querySelector(".name span").innerHTML = spanHTML;
          suggestions.push({ score: res.score, commandNode });
        }
      });
      if (suggestions.length > 0) {
        suggestions.sort((a, b) => b.score - a.score).slice(this.maxSuggestionNum);
        container = this.createCommandsContainer();
        container.classList.add("suggestions");
        suggestions.forEach((suggestion) => {
          container.appendChild(suggestion.commandNode);
        });
        return true;
      } else {
        const anonymousCommand = this.commands.find((c) => !c.name && (!c.when || c.when()));
        if (anonymousCommand) {
          await this.execCallback(anonymousCommand.callback);
        } else {
          this.showTip(this.defaultText.empty);
        }
        return false;
      }
    }
    /**
     * Bind events of pressing `keydown` and `keyup` key.
     */
    initInputEvents() {
      this.promptNode.addEventListener("keydown", (event) => {
        if (["ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          let selectedIndex;
          const allItems = [
            ...Array.from(this.getCommandsContainer().querySelectorAll(".command"))
          ].filter((e) => e.style.display != "none");
          selectedIndex = allItems.findIndex((e) => e.classList.contains("selected"));
          if (selectedIndex != -1) {
            allItems[selectedIndex].classList.remove("selected");
            selectedIndex += event.key == "ArrowUp" ? -1 : 1;
          } else {
            if (event.key == "ArrowUp") {
              selectedIndex = allItems.length - 1;
            } else {
              selectedIndex = 0;
            }
          }
          if (selectedIndex == -1) {
            selectedIndex = allItems.length - 1;
          } else if (selectedIndex == allItems.length) {
            selectedIndex = 0;
          }
          allItems[selectedIndex].classList.add("selected");
          const commandsContainer = this.getCommandsContainer();
          commandsContainer.scrollTo(0, commandsContainer.querySelector(".selected").offsetTop - commandsContainer.offsetHeight + 7.5);
          allItems[selectedIndex].classList.add("selected");
        }
      });
      this.promptNode.addEventListener("keyup", async (event) => {
        if (event.key == "Enter") {
          this.trigger();
        } else if (event.key == "Escape") {
          if (this.inputNode.value.length > 0) {
            this.inputNode.value = "";
          } else {
            this.exit();
          }
        } else if (["ArrowUp", "ArrowDown"].includes(event.key)) {
          return;
        }
        const currentInputText = this.inputNode.value;
        if (currentInputText == this.lastInputText) {
          return;
        }
        this.lastInputText = currentInputText;
        window.setTimeout(async () => {
          await this.showSuggestions(currentInputText);
        });
      });
    }
    /**
     * Create a commandsContainer and display a text
     */
    showTip(text) {
      const tipNode = this.ui.createElement(this.document, "div", {
        classList: ["tip"],
        properties: {
          innerText: text
        }
      });
      const container = this.createCommandsContainer();
      container.classList.add("suggestions");
      container.appendChild(tipNode);
      return tipNode;
    }
    /**
     * Mark the selected item with class `selected`.
     * @param item HTMLDivElement
     */
    selectItem(item) {
      this.getCommandsContainer().querySelectorAll(".command").forEach((e) => e.classList.remove("selected"));
      item.classList.add("selected");
    }
    addStyle() {
      const style2 = this.ui.createElement(this.document, "style", {
        namespace: "html",
        id: "prompt-style"
      });
      style2.innerText = `
      .prompt-container * {
        box-sizing: border-box;
      }
      .prompt-container {
        ---radius---: 10px;
        position: fixed;
        left: 25%;
        top: 10%;
        width: 50%;
        border-radius: var(---radius---);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        font-size: 18px;
        box-shadow: 0px 1.8px 7.3px rgba(0, 0, 0, 0.071),
                    0px 6.3px 24.7px rgba(0, 0, 0, 0.112),
                    0px 30px 90px rgba(0, 0, 0, 0.2);
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Microsoft YaHei Light", sans-serif;
        background-color: var(--material-background) !important;
        border: var(--material-border-quarternary) !important;
      }
      
      /* input */
      .prompt-container .input-container  {
        width: 100%;
      }

      .input-container input {
        width: -moz-available;
        height: 40px;
        padding: 24px;
        border: none;
        outline: none;
        font-size: 18px;
        margin: 0 !important;
        border-radius: var(---radius---);
        background-color: var(--material-background);
      }
      
      .input-container .cta {
        border-bottom: var(--material-border-quarternary);
        margin: 5px auto;
      }
      
      /* results */
      .commands-containers {
        width: 100%;
        height: 100%;
      }
      .commands-container {
        max-height: calc(${this.maxLineNum} * 35.5px);
        width: calc(100% - 12px);
        margin-left: 12px;
        margin-right: 0%;
        overflow-y: auto;
        overflow-x: hidden;
      }
      
      .commands-container .command {
        display: flex;
        align-content: baseline;
        justify-content: space-between;
        border-radius: 5px;
        padding: 6px 12px;
        margin-right: 12px;
        margin-top: 2px;
        margin-bottom: 2px;
      }
      .commands-container .command .content {
        display: flex;
        width: 100%;
        justify-content: space-between;
        flex-direction: row;
        overflow: hidden;
      }
      .commands-container .command .content .name {
        white-space: nowrap; 
        text-overflow: ellipsis;
        overflow: hidden;
      }
      .commands-container .command .content .aux {
        display: flex;
        align-items: center;
        align-self: center;
        flex-shrink: 0;
      }
      
      .commands-container .command .content .aux .label {
        font-size: 15px;
        color: var(--fill-primary);
        padding: 2px 6px;
        background-color: var(--color-background);
        border-radius: 5px;
      }
      
      .commands-container .selected {
          background-color: var(--material-mix-quinary);
      }

      .commands-container .highlight {
        font-weight: bold;
      }

      .tip {
        color: var(--fill-primary);
        text-align: center;
        padding: 12px 12px;
        font-size: 18px;
      }

      /* instructions */
      .instructions {
        display: flex;
        align-content: center;
        justify-content: center;
        font-size: 15px;
        height: 2.5em;
        width: 100%;
        border-top: var(--material-border-quarternary);
        color: var(--fill-secondary);
        margin-top: 5px;
      }
      
      .instructions .instruction {
        margin: auto .5em;  
      }
      
      .instructions .key {
        margin-right: .2em;
        font-weight: 600;
      }
    `;
      this.document.documentElement.appendChild(style2);
    }
    registerShortcut() {
      this.document.addEventListener("keydown", (event) => {
        if (event.shiftKey && event.key.toLowerCase() == "p") {
          if (event.originalTarget.isContentEditable || "value" in event.originalTarget || this.commands.length == 0) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          if (this.promptNode.style.display == "none") {
            this.promptNode.style.display = "flex";
            if (this.promptNode.querySelectorAll(".commands-container").length == 1) {
              this.showCommands(this.commands, true);
            }
            this.promptNode.focus();
            this.inputNode.focus();
          } else {
            this.promptNode.style.display = "none";
          }
        }
      }, true);
    }
  };
  var PromptManager = class extends ManagerTool {
    prompt;
    /**
     * Save the commands registered from this manager
     */
    commands = [];
    constructor(base) {
      super(base);
      const globalCache = toolkitGlobal_default.getInstance()?.prompt;
      if (!globalCache) {
        throw new Error("Prompt is not initialized.");
      }
      if (!globalCache._ready) {
        globalCache._ready = true;
        globalCache.instance = new Prompt();
      }
      this.prompt = globalCache.instance;
    }
    /**
     * Register commands. Don't forget to call `unregister` on plugin exit.
     * @param commands Command[]
     * @example
     * ```ts
     * let getReader = () => {
     *   return BasicTool.getZotero().Reader.getByTabID(
     *     (Zotero.getMainWindow().Zotero_Tabs).selectedID
     *   )
     * }
     *
     * register([
     *   {
     *     name: "Split Horizontally",
     *     label: "Zotero",
     *     when: () => getReader() as boolean,
     *     callback: (prompt: Prompt) => getReader().menuCmd("splitHorizontally")
     *   },
     *   {
     *     name: "Split Vertically",
     *     label: "Zotero",
     *     when: () => getReader() as boolean,
     *     callback: (prompt: Prompt) => getReader().menuCmd("splitVertically")
     *   }
     * ])
     * ```
     */
    register(commands) {
      commands.forEach((c) => c.id ??= c.name);
      this.prompt.commands = [...this.prompt.commands, ...commands];
      this.commands = [...this.commands, ...commands];
      this.prompt.showCommands(this.commands, true);
    }
    /**
     * You can delete a command registed before by its name.
     * @remarks
     * There is a premise here that the names of all commands registered by a single plugin are not duplicated.
     * @param id Command.name
     */
    unregister(id) {
      this.prompt.commands = this.prompt.commands.filter((c) => c.id != id);
      this.commands = this.commands.filter((c) => c.id != id);
    }
    /**
     * Call `unregisterAll` on plugin exit.
     */
    unregisterAll() {
      this.prompt.commands = this.prompt.commands.filter((c) => {
        return this.commands.every((_c) => _c.id != c.id);
      });
      this.commands = [];
    }
  };

  // node_modules/zotero-plugin-toolkit/dist/tools/extraField.js
  var ExtraFieldTool = class extends BasicTool {
    /**
     * Get all extra fields
     * @param item
     */
    getExtraFields(item, backend = "custom") {
      const extraFiledRaw = item.getField("extra");
      if (backend === "default") {
        return this.getGlobal("Zotero").Utilities.Internal.extractExtraFields(extraFiledRaw).fields;
      } else {
        const map = /* @__PURE__ */ new Map();
        const nonStandardFields = [];
        extraFiledRaw.split("\n").forEach((line) => {
          const split = line.split(": ");
          if (split.length >= 2 && split[0]) {
            map.set(split[0], split.slice(1).join(": "));
          } else {
            nonStandardFields.push(line);
          }
        });
        map.set("__nonStandard__", nonStandardFields.join("\n"));
        return map;
      }
    }
    /**
     * Get extra field value by key. If it does not exists, return undefined.
     * @param item
     * @param key
     */
    getExtraField(item, key) {
      const fields = this.getExtraFields(item);
      return fields.get(key);
    }
    /**
     * Replace extra field of an item.
     * @param item
     * @param fields
     */
    async replaceExtraFields(item, fields) {
      const kvs = [];
      if (fields.has("__nonStandard__")) {
        kvs.push(fields.get("__nonStandard__"));
        fields.delete("__nonStandard__");
      }
      fields.forEach((v, k) => {
        kvs.push(`${k}: ${v}`);
      });
      item.setField("extra", kvs.join("\n"));
      await item.saveTx();
    }
    /**
     * Set an key-value pair to the item's extra field
     * @param item
     * @param key
     * @param value
     */
    async setExtraField(item, key, value) {
      const fields = this.getExtraFields(item);
      if (value === "" || typeof value === "undefined") {
        fields.delete(key);
      } else {
        fields.set(key, value);
      }
      await this.replaceExtraFields(item, fields);
    }
  };

  // node_modules/zotero-plugin-toolkit/dist/tools/reader.js
  var ReaderTool = class extends BasicTool {
    /**
     * Get the selected tab reader.
     * @param waitTime Wait for n MS until the reader is ready
     */
    async getReader(waitTime = 5e3) {
      const Zotero_Tabs = this.getGlobal("Zotero_Tabs");
      if (Zotero_Tabs.selectedType !== "reader") {
        return void 0;
      }
      let reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
      let delayCount = 0;
      const checkPeriod = 50;
      while (!reader && delayCount * checkPeriod < waitTime) {
        await new Promise((resolve) => setTimeout(resolve, checkPeriod));
        reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
        delayCount++;
      }
      await reader?._initPromise;
      return reader;
    }
    /**
     * Get all window readers.
     */
    getWindowReader() {
      const Zotero_Tabs = this.getGlobal("Zotero_Tabs");
      const windowReaders = [];
      const tabs = Zotero_Tabs._tabs.map((e) => e.id);
      for (let i = 0; i < Zotero.Reader._readers.length; i++) {
        let flag = false;
        for (let j = 0; j < tabs.length; j++) {
          if (Zotero.Reader._readers[i].tabID === tabs[j]) {
            flag = true;
            break;
          }
        }
        if (!flag) {
          windowReaders.push(Zotero.Reader._readers[i]);
        }
      }
      return windowReaders;
    }
    /**
     * Get Reader tabpanel deck element.
     * @deprecated - use item pane api
     * @alpha
     */
    getReaderTabPanelDeck() {
      const deck = this.getGlobal("window").document.querySelector(".notes-pane-deck")?.previousElementSibling;
      return deck;
    }
    /**
     * Add a reader tabpanel deck selection change observer.
     * @deprecated - use item pane api
     * @alpha
     * @param callback
     */
    async addReaderTabPanelDeckObserver(callback) {
      await waitUtilAsync(() => !!this.getReaderTabPanelDeck());
      const deck = this.getReaderTabPanelDeck();
      const observer = new (this.getGlobal("MutationObserver"))(async (mutations) => {
        mutations.forEach(async (mutation) => {
          const target = mutation.target;
          if (target.classList.contains("zotero-view-tabbox") || target.tagName === "deck") {
            callback();
          }
        });
      });
      observer.observe(deck, {
        attributes: true,
        attributeFilter: ["selectedIndex"],
        subtree: true
      });
      return observer;
    }
    /**
     * Get the selected annotation data.
     * @param reader Target reader
     * @returns The selected annotation data.
     */
    getSelectedAnnotationData(reader) {
      const annotation = (
        // @ts-expect-error _selectionPopup
        reader?._internalReader._lastView._selectionPopup?.annotation
      );
      return annotation;
    }
    /**
     * Get the text selection of reader.
     * @param reader Target reader
     * @returns The text selection of reader.
     */
    getSelectedText(reader) {
      return this.getSelectedAnnotationData(reader)?.text ?? "";
    }
  };

  // node_modules/zotero-plugin-toolkit/dist/ztoolkit.js
  var ZoteroToolkit = class extends BasicTool {
    static _version = BasicTool._version;
    UI = new UITool(this);
    Reader = new ReaderTool(this);
    ExtraField = new ExtraFieldTool(this);
    FieldHooks = new FieldHookManager(this);
    Keyboard = new KeyboardManager(this);
    Prompt = new PromptManager(this);
    Menu = new MenuManager(this);
    Clipboard = makeHelperTool(ClipboardHelper, this);
    FilePicker = makeHelperTool(FilePickerHelper, this);
    Patch = makeHelperTool(PatchHelper, this);
    ProgressWindow = makeHelperTool(ProgressWindowHelper, this);
    VirtualizedTable = makeHelperTool(VirtualizedTableHelper, this);
    Dialog = makeHelperTool(DialogHelper, this);
    LargePrefObject = makeHelperTool(LargePrefHelper, this);
    Guide = makeHelperTool(GuideHelper, this);
    constructor() {
      super();
    }
    /**
     * Unregister everything created by managers.
     */
    unregisterAll() {
      unregister(this);
    }
  };

  // package.json
  var config = {
    addonName: "Zotero MCP Plugin Ext",
    addonID: "zotero-mcp-ext@autoagent.my",
    addonRef: "zotero-mcp-ext",
    addonInstance: "ZoteroMCPExt",
    prefsPrefix: "extensions.zotero.zotero-mcp-ext"
  };

  // src/modules/httpServer.ts
  init_streamableMCPServer();

  // src/modules/mcpTest.ts
  async function testMCPIntegration() {
    const tests = [];
    const startTime = Date.now();
    await runTest("MCP Initialize", async () => {
      const request = {
        jsonrpc: "2.0",
        id: "test-1",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0"
          }
        }
      };
      const { StreamableMCPServer: StreamableMCPServer2 } = await Promise.resolve().then(() => (init_streamableMCPServer(), streamableMCPServer_exports));
      const mcpServer = new StreamableMCPServer2();
      const response = await mcpServer.processRequest(request);
      if (response.result && response.result.protocolVersion === "2024-11-05") {
        return { success: true, response };
      } else {
        throw new Error("Invalid initialize response");
      }
    }, tests);
    await runTest("Tools List", async () => {
      const request = {
        jsonrpc: "2.0",
        id: "test-2",
        method: "tools/list",
        params: {}
      };
      const { StreamableMCPServer: StreamableMCPServer2 } = await Promise.resolve().then(() => (init_streamableMCPServer(), streamableMCPServer_exports));
      const mcpServer = new StreamableMCPServer2();
      const response = await mcpServer.processRequest(request);
      if (response.result && response.result.tools && Array.isArray(response.result.tools)) {
        const tools = response.result.tools;
        const expectedTools = ["search_library", "search_annotations", "get_item_details"];
        const hasExpectedTools = expectedTools.every(
          (tool) => tools.some((t) => t.name === tool)
        );
        if (hasExpectedTools) {
          return { success: true, toolCount: tools.length, tools: tools.map((t) => t.name) };
        } else {
          throw new Error("Missing expected tools");
        }
      } else {
        throw new Error("Invalid tools list response");
      }
    }, tests);
    await runTest("Tool Call - Ping", async () => {
      const request = {
        jsonrpc: "2.0",
        id: "test-3",
        method: "tools/call",
        params: {
          name: "ping",
          arguments: {}
        }
      };
      const { StreamableMCPServer: StreamableMCPServer2 } = await Promise.resolve().then(() => (init_streamableMCPServer(), streamableMCPServer_exports));
      const mcpServer = new StreamableMCPServer2();
      const response = await mcpServer.processRequest(request);
      if (response.result) {
        return { success: true, response: response.result };
      } else {
        throw new Error("Ping tool call failed");
      }
    }, tests);
    await runTest("MCP Server Status", async () => {
      const { StreamableMCPServer: StreamableMCPServer2 } = await Promise.resolve().then(() => (init_streamableMCPServer(), streamableMCPServer_exports));
      const mcpServer = new StreamableMCPServer2();
      const status = mcpServer.getStatus();
      if (status.serverInfo && status.protocolVersion && status.availableTools) {
        return { success: true, status };
      } else {
        throw new Error("Invalid status response");
      }
    }, tests);
    await runTest("Error Handling", async () => {
      const request = {
        jsonrpc: "2.0",
        id: "test-5",
        method: "invalid/method",
        params: {}
      };
      const { StreamableMCPServer: StreamableMCPServer2 } = await Promise.resolve().then(() => (init_streamableMCPServer(), streamableMCPServer_exports));
      const mcpServer = new StreamableMCPServer2();
      const response = await mcpServer.processRequest(request);
      if (response.error && response.error.code === -32601) {
        return { success: true, error: response.error };
      } else {
        throw new Error("Error handling failed");
      }
    }, tests);
    const endTime = Date.now();
    const duration = endTime - startTime;
    const summary = {
      total: tests.length,
      passed: tests.filter((t) => t.status === "PASSED").length,
      failed: tests.filter((t) => t.status === "FAILED").length,
      successRate: `${(tests.filter((t) => t.status === "PASSED").length / tests.length * 100).toFixed(1)}%`
    };
    ztoolkit.log(`[MCPTest] Completed ${tests.length} tests in ${duration}ms: ${summary.passed} passed, ${summary.failed} failed`);
    return {
      message: "MCP integration test completed",
      message_zh: "MCP\u96C6\u6210\u6D4B\u8BD5\u5B8C\u6210",
      testResults: {
        summary,
        tests,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  }
  async function runTest(testName, testFunction, tests) {
    const startTime = Date.now();
    try {
      ztoolkit.log(`[MCPTest] Running: ${testName}`);
      const result = await testFunction();
      const duration = Date.now() - startTime;
      tests.push({
        testName,
        status: "PASSED",
        duration,
        result
      });
      ztoolkit.log(`[MCPTest] \u2713 ${testName} passed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      tests.push({
        testName,
        status: "FAILED",
        duration,
        error: errorMessage
      });
      ztoolkit.log(`[MCPTest] \u2717 ${testName} failed in ${duration}ms: ${errorMessage}`);
    }
  }

  // src/modules/httpServer.ts
  var HttpServer = class {
    static testServer() {
      Zotero.debug("Static testServer method called.");
    }
    serverSocket;
    isRunning = false;
    mcpServer = null;
    port = 8080;
    activeSessions = /* @__PURE__ */ new Map();
    keepAliveTimeout = 3e4;
    // 30 seconds
    sessionTimeout = 3e5;
    // 5 minutes
    isServerRunning() {
      return this.isRunning;
    }
    start(port) {
      if (this.isRunning) {
        Zotero.debug("[HttpServer] Server is already running.");
        return;
      }
      if (!port || isNaN(port) || port < 1 || port > 65535) {
        const errorMsg = `[HttpServer] Invalid port number: ${port}. Port must be between 1 and 65535.`;
        Zotero.debug(errorMsg);
        throw new Error(errorMsg);
      }
      try {
        this.port = port;
        Zotero.debug(
          `[HttpServer] Attempting to start server on port ${port}...`
        );
        this.serverSocket = Cc["@mozilla.org/network/server-socket;1"].createInstance(Ci.nsIServerSocket);
        this.serverSocket.init(port, true, -1);
        this.serverSocket.asyncListen(this.listener);
        this.isRunning = true;
        Zotero.debug(
          `[HttpServer] Successfully started HTTP server on port ${port}`
        );
        this.initializeMCPServer();
        this.startSessionCleanup();
      } catch (e) {
        const errorMsg = `[HttpServer] Failed to start server on port ${port}: ${e}`;
        Zotero.debug(errorMsg);
        this.stop();
        throw new Error(errorMsg);
      }
    }
    initializeMCPServer() {
      try {
        this.mcpServer = new StreamableMCPServer();
        ztoolkit.log(`[HttpServer] Integrated MCP server initialized`);
      } catch (error) {
        ztoolkit.log(`[HttpServer] Failed to initialize MCP server: ${error}`);
      }
    }
    stop() {
      if (!this.isRunning || !this.serverSocket) {
        Zotero.debug(
          "[HttpServer] Server is not running or socket is null, nothing to stop."
        );
        return;
      }
      try {
        this.serverSocket.close();
        this.isRunning = false;
        Zotero.debug("[HttpServer] HTTP server stopped successfully.");
      } catch (e) {
        Zotero.debug(`[HttpServer] Error stopping server: ${e}`);
      }
      this.cleanupMCPServer();
    }
    cleanupMCPServer() {
      if (this.mcpServer) {
        this.mcpServer = null;
        ztoolkit.log("[HttpServer] MCP server cleaned up");
      }
    }
    /**
     * Generate a unique session ID for MCP connections
     */
    generateSessionId() {
      return "mcp-" + Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 9);
    }
    /**
     * Start session cleanup timer to remove expired sessions
     */
    startSessionCleanup() {
      setInterval(() => {
        const now = /* @__PURE__ */ new Date();
        for (const [sessionId, session] of this.activeSessions.entries()) {
          if (now.getTime() - session.lastActivity.getTime() > this.sessionTimeout) {
            this.activeSessions.delete(sessionId);
            ztoolkit.log(`[HttpServer] Cleaned up expired session: ${sessionId}`);
          }
        }
      }, 6e4);
    }
    /**
     * Update session activity
     */
    updateSessionActivity(sessionId) {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.lastActivity = /* @__PURE__ */ new Date();
      }
    }
    /**
     * Determine if connection should be kept alive based on request
     */
    shouldKeepAlive(requestText, path) {
      if (path === "/mcp" || path.startsWith("/mcp/")) {
        return true;
      }
      const connectionHeader = requestText.match(/Connection:\s*([^\r\n]+)/i);
      if (connectionHeader && connectionHeader[1].toLowerCase().includes("keep-alive")) {
        return true;
      }
      return false;
    }
    /**
     * Build appropriate HTTP headers with session and connection management
     */
    buildHttpHeaders(result, keepAlive, sessionId) {
      const baseHeaders = `HTTP/1.1 ${result.status} ${result.statusText}\r
Content-Type: ${result.headers?.["Content-Type"] || "application/json; charset=utf-8"}\r
`;
      let headers = baseHeaders;
      if (sessionId) {
        headers += `Mcp-Session-Id: ${sessionId}\r
`;
      }
      if (keepAlive) {
        headers += `Connection: keep-alive\r
Keep-Alive: timeout=${this.keepAliveTimeout / 1e3}, max=100\r
`;
      } else {
        headers += `Connection: close\r
`;
      }
      return headers;
    }
    listener = {
      onSocketAccepted: async (_socket, transport) => {
        let input = null;
        let output = null;
        let sin = null;
        const converterStream = null;
        ztoolkit.log(`[HttpServer] New connection accepted from transport: ${transport.host || "unknown"}:${transport.port || "unknown"}`);
        try {
          input = transport.openInputStream(0, 0, 0);
          output = transport.openOutputStream(0, 0, 0);
          const converterStream2 = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);
          converterStream2.init(input, "UTF-8", 0, 0);
          sin = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(
            Ci.nsIScriptableInputStream
          );
          sin.init(input);
          let requestText = "";
          let totalBytesRead = 0;
          const maxRequestSize = 4096;
          let waitAttempts = 0;
          const maxWaitAttempts = 10;
          try {
            while (totalBytesRead < maxRequestSize) {
              const bytesToRead = Math.min(1024, maxRequestSize - totalBytesRead);
              const available = input.available();
              if (available === 0) {
                waitAttempts++;
                if (waitAttempts > maxWaitAttempts) {
                  ztoolkit.log(`[HttpServer] Timeout waiting for data after ${waitAttempts} attempts, TotalBytes: ${totalBytesRead}`, "warn");
                  break;
                }
                await new Promise((resolve) => setTimeout(resolve, 10));
                if (input.available() === 0) {
                  continue;
                }
              }
              let chunk = "";
              try {
                const str = {};
                const bytesRead = converterStream2.readString(bytesToRead, str);
                chunk = str.value || "";
                if (bytesRead === 0) break;
              } catch (converterError) {
                ztoolkit.log(
                  `[HttpServer] Converter failed, using fallback: ${converterError}`,
                  "error"
                );
                chunk = sin.read(bytesToRead);
                if (!chunk) break;
              }
              requestText += chunk;
              totalBytesRead += chunk.length;
              if (requestText.includes("\r\n\r\n")) {
                break;
              }
            }
          } catch (readError) {
            ztoolkit.log(
              `[HttpServer] Error reading request: ${readError}, BytesRead: ${totalBytesRead}, InputStream available: ${input?.available ? input.available() : "N/A"}`,
              "error"
            );
            requestText = requestText || "INVALID_REQUEST";
          }
          ztoolkit.log(`[HttpServer] Total bytes read: ${totalBytesRead}, request text length: ${requestText.length}`);
          try {
            if (converterStream2) converterStream2.close();
          } catch (e) {
            ztoolkit.log(
              `[HttpServer] Error closing converter stream: ${e}`,
              "error"
            );
          }
          if (sin) sin.close();
          if (totalBytesRead === 0 && requestText.length === 0) {
            ztoolkit.log(
              `[HttpServer] Empty connection detected - likely health check/probe. Closing gracefully.`,
              "info"
            );
            return;
          }
          const requestLine = requestText.split("\r\n")[0];
          ztoolkit.log(
            `[HttpServer] Received request: ${requestLine} (${requestText.length} bytes)`
          );
          if (!requestLine || !requestLine.includes("HTTP/")) {
            ztoolkit.log(
              `[HttpServer] Invalid request format - RequestLine: "${requestLine || "<empty>"}", TotalBytes: ${totalBytesRead}, RequestLength: ${requestText.length}, RequestPreview: "${requestText.substring(0, 100).replace(/\r?\n/g, "\\n")}"`,
              "error"
            );
            try {
              const badRequestResult = {
                status: 400,
                statusText: "Bad Request",
                headers: { "Content-Type": "text/plain; charset=utf-8" }
              };
              const badRequestHeaders = this.buildHttpHeaders(badRequestResult, false) + "Content-Length: 11\r\n\r\n";
              const errorResponse = badRequestHeaders + "Bad Request";
              output.write(errorResponse, errorResponse.length);
            } catch (e) {
              ztoolkit.log(
                `[HttpServer] Error sending bad request response: ${e}`,
                "error"
              );
            }
            ztoolkit.log(
              `[HttpServer] Returned 400 Bad Request due to invalid format. Connection will be closed.`,
              "warn"
            );
            return;
          }
          try {
            const requestParts = requestLine.split(" ");
            const method = requestParts[0];
            const urlPath = requestParts[1];
            const url = new URL(urlPath, "http://127.0.0.1");
            const query = new URLSearchParams(url.search);
            const path = url.pathname;
            let requestBody = "";
            if (method === "POST") {
              const bodyStart = requestText.indexOf("\r\n\r\n");
              if (bodyStart !== -1) {
                requestBody = requestText.substring(bodyStart + 4);
              }
            }
            let sessionId;
            const mcpSessionHeader = requestText.match(/Mcp-Session-Id:\s*([^\r\n]+)/i);
            if (path === "/mcp" || path.startsWith("/mcp/")) {
              if (mcpSessionHeader && mcpSessionHeader[1]) {
                sessionId = mcpSessionHeader[1].trim();
                this.updateSessionActivity(sessionId);
                ztoolkit.log(`[HttpServer] Using existing MCP session: ${sessionId}`);
              } else {
                sessionId = this.generateSessionId();
                this.activeSessions.set(sessionId, {
                  createdAt: /* @__PURE__ */ new Date(),
                  lastActivity: /* @__PURE__ */ new Date()
                });
                ztoolkit.log(`[HttpServer] Created new MCP session: ${sessionId}`);
              }
            }
            const keepAlive = this.shouldKeepAlive(requestText, path);
            ztoolkit.log(`[HttpServer] Keep-alive for ${path}: ${keepAlive}`);
            let result;
            if (path === "/mcp") {
              if (method === "POST") {
                if (this.mcpServer) {
                  result = await this.mcpServer.handleMCPRequest(requestBody);
                } else {
                  result = {
                    status: 503,
                    statusText: "Service Unavailable",
                    headers: { "Content-Type": "application/json; charset=utf-8" },
                    body: JSON.stringify({ error: "MCP server not enabled" })
                  };
                }
              } else if (method === "GET") {
                result = {
                  status: 200,
                  statusText: "OK",
                  headers: { "Content-Type": "application/json; charset=utf-8" },
                  body: JSON.stringify({
                    endpoint: "/mcp",
                    protocol: "MCP (Model Context Protocol)",
                    transport: "Streamable HTTP",
                    version: "2024-11-05",
                    description: "This endpoint accepts MCP protocol requests via POST method",
                    usage: {
                      method: "POST",
                      contentType: "application/json",
                      body: "MCP JSON-RPC 2.0 formatted requests"
                    },
                    status: this.mcpServer ? "available" : "disabled",
                    documentation: "Send POST requests with MCP protocol messages to interact with Zotero data"
                  })
                };
              } else {
                result = {
                  status: 405,
                  statusText: "Method Not Allowed",
                  headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Allow": "GET, POST"
                  },
                  body: JSON.stringify({
                    error: `Method ${method} not allowed. Use GET for info or POST for MCP requests.`
                  })
                };
              }
            } else if (path === "/mcp/status") {
              if (this.mcpServer) {
                result = {
                  status: 200,
                  statusText: "OK",
                  headers: { "Content-Type": "application/json; charset=utf-8" },
                  body: JSON.stringify(this.mcpServer.getStatus())
                };
              } else {
                result = {
                  status: 503,
                  statusText: "Service Unavailable",
                  headers: { "Content-Type": "application/json; charset=utf-8" },
                  body: JSON.stringify({ error: "MCP server not enabled", enabled: false })
                };
              }
            } else if (path === "/mcp/capabilities" || path === "/capabilities" || path === "/help") {
              result = {
                status: 200,
                statusText: "OK",
                headers: { "Content-Type": "application/json; charset=utf-8" },
                body: JSON.stringify(this.getCapabilities())
              };
            } else if (path === "/test/mcp") {
              const testResult = await testMCPIntegration();
              result = {
                status: 200,
                statusText: "OK",
                headers: { "Content-Type": "application/json; charset=utf-8" },
                body: JSON.stringify(testResult)
              };
            } else if (path.startsWith("/ping")) {
              const pingResult = {
                status: 200,
                statusText: "OK",
                headers: { "Content-Type": "text/plain; charset=utf-8" }
              };
              const pingHeaders = this.buildHttpHeaders(pingResult, keepAlive) + "Content-Length: 4\r\n\r\n";
              const response = pingHeaders + "pong";
              output.write(response, response.length);
              return;
            } else {
              const notFoundResult = {
                status: 404,
                statusText: "Not Found",
                headers: { "Content-Type": "text/plain; charset=utf-8" }
              };
              const notFoundHeaders = this.buildHttpHeaders(notFoundResult, false) + "Content-Length: 9\r\n\r\n";
              const response = notFoundHeaders + "Not Found";
              output.write(response, response.length);
              return;
            }
            const body = result.body || "";
            const storageStream = Cc["@mozilla.org/storagestream;1"].createInstance(Ci.nsIStorageStream);
            storageStream.init(8192, 4294967295);
            const storageConverter = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
            storageConverter.init(
              storageStream.getOutputStream(0),
              "UTF-8",
              0,
              63
            );
            storageConverter.writeString(body);
            storageConverter.close();
            const byteLength = storageStream.length;
            const finalHeaders = this.buildHttpHeaders(result, keepAlive, sessionId) + `Content-Length: ${byteLength}\r
\r
`;
            ztoolkit.log(`[HttpServer] Sending response with headers: ${finalHeaders.split("\r\n").slice(0, -2).join(", ")}`);
            output.write(finalHeaders, finalHeaders.length);
            if (byteLength > 0) {
              const inputStream = storageStream.newInputStream(0);
              output.writeFrom(inputStream, byteLength);
            }
          } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            ztoolkit.log(
              `[HttpServer] Error in request handling: ${error.message}`,
              "error"
            );
            const errorBody = JSON.stringify({ error: error.message });
            const errorResult = {
              status: 500,
              statusText: "Internal Server Error",
              headers: { "Content-Type": "application/json; charset=utf-8" }
            };
            const errorHeaders = this.buildHttpHeaders(errorResult, false) + `Content-Length: ${errorBody.length}\r
\r
`;
            const errorResponse = errorHeaders + errorBody;
            output.write(errorResponse, errorResponse.length);
          }
        } catch (e) {
          const error = e instanceof Error ? e : new Error(String(e));
          ztoolkit.log(
            `[HttpServer] Error handling request: ${error.message}`,
            "error"
          );
          ztoolkit.log(`[HttpServer] Error stack: ${error.stack}`, "error");
          try {
            if (!output) {
              output = transport.openOutputStream(0, 0, 0);
            }
            const criticalErrorResult = {
              status: 500,
              statusText: "Internal Server Error",
              headers: { "Content-Type": "text/plain; charset=utf-8" }
            };
            const criticalErrorHeaders = this.buildHttpHeaders(criticalErrorResult, false) + "Content-Length: 21\r\n\r\n";
            const errorResponse = criticalErrorHeaders + "Internal Server Error";
            output.write(errorResponse, errorResponse.length);
            ztoolkit.log(`[HttpServer] Error response sent`);
          } catch (closeError) {
            ztoolkit.log(
              `[HttpServer] Error sending error response: ${closeError}`,
              "error"
            );
          }
        } finally {
          try {
            if (output) {
              output.close();
              ztoolkit.log(`[HttpServer] Output stream closed`);
            }
          } catch (e) {
            ztoolkit.log(
              `[HttpServer] Error closing output stream: ${e}`,
              "error"
            );
          }
          try {
            if (input) {
              input.close();
              ztoolkit.log(`[HttpServer] Input stream closed`);
            }
          } catch (e) {
            ztoolkit.log(
              `[HttpServer] Error closing input stream: ${e}`,
              "error"
            );
          }
        }
      },
      onStopListening: () => {
        this.isRunning = false;
      }
    };
    /**
     * Get comprehensive capabilities and API documentation
     */
    getCapabilities() {
      return {
        serverInfo: {
          name: "Zotero MCP Plugin",
          version: "1.1.0",
          description: "Model Context Protocol integration for Zotero research management",
          author: "Zotero MCP Team",
          repository: "https://github.com/zotero/zotero-mcp",
          documentation: "https://github.com/zotero/zotero-mcp-ext/blob/main/README.md"
        },
        protocols: {
          mcp: {
            version: "2024-11-05",
            transport: "streamable-http",
            endpoint: "/mcp",
            description: "Full MCP protocol support for AI clients"
          },
          rest: {
            version: "1.1.0",
            description: "REST API for direct HTTP access",
            baseUrl: `http://127.0.0.1:${this.port}`
          }
        },
        capabilities: {
          search: {
            library: true,
            annotations: true,
            collections: true,
            fullText: true,
            advanced: true
          },
          retrieval: {
            items: true,
            annotations: true,
            pdfContent: true,
            collections: true,
            notes: true
          },
          formats: {
            json: true,
            text: true,
            markdown: false
          }
        },
        tools: [
          {
            name: "search_library",
            description: "Search the Zotero library with advanced parameters including boolean operators, relevance scoring, fulltext search, and pagination. Returns: {query, pagination, searchTime, results: [{key, title, creators, date, attachments: [{key, filename, filePath, contentType, linkMode}], fulltextMatch: {query, mode, attachments: [{snippet, score}], notes: [{snippet, score}]}}], searchFeatures, version}",
            category: "search",
            parameters: {
              q: { type: "string", description: "General search query", required: false },
              title: { type: "string", description: "Title search", required: false },
              titleOperator: {
                type: "string",
                enum: ["contains", "exact", "startsWith", "endsWith", "regex"],
                description: "Title search operator",
                required: false
              },
              yearRange: { type: "string", description: "Year range (e.g., '2020-2023')", required: false },
              fulltext: { type: "string", description: "Full-text search in attachments and notes", required: false },
              fulltextMode: {
                type: "string",
                enum: ["attachment", "note", "both"],
                description: "Full-text search mode: 'attachment' (PDFs only), 'note' (notes only), 'both' (default)",
                required: false
              },
              fulltextOperator: {
                type: "string",
                enum: ["contains", "exact", "regex"],
                description: "Full-text search operator (default: 'contains')",
                required: false
              },
              relevanceScoring: { type: "boolean", description: "Enable relevance scoring", required: false },
              sort: {
                type: "string",
                enum: ["relevance", "date", "title", "year"],
                description: "Sort order",
                required: false
              },
              limit: { type: "number", description: "Maximum results to return", required: false },
              offset: { type: "number", description: "Pagination offset", required: false }
            },
            examples: [
              { query: { q: "machine learning" }, description: "Basic text search" },
              { query: { title: "deep learning", titleOperator: "contains" }, description: "Title-specific search" },
              { query: { yearRange: "2020-2023", sort: "relevance" }, description: "Year-filtered search with relevance sorting" },
              { query: { fulltext: "neural networks", fulltextMode: "attachment" }, description: "Full-text search in PDF attachments only" },
              { query: { fulltext: "methodology", fulltextMode: "both", fulltextOperator: "exact" }, description: "Exact full-text search in both attachments and notes" }
            ]
          },
          {
            name: "search_annotations",
            description: "Search all notes, PDF annotations and highlights with smart content processing",
            category: "search",
            parameters: {
              q: { type: "string", description: "Search query for content, comments, and tags", required: false },
              type: {
                type: "string",
                enum: ["note", "highlight", "annotation", "ink", "text", "image"],
                description: "Filter by annotation type",
                required: false
              },
              detailed: { type: "boolean", description: "Return detailed content (default: false for preview)", required: false },
              limit: { type: "number", description: "Maximum results (preview: 20, detailed: 50)", required: false },
              offset: { type: "number", description: "Pagination offset", required: false }
            },
            examples: [
              { query: { q: "important findings" }, description: "Search annotation content" },
              { query: { type: "highlight", detailed: true }, description: "Get detailed highlights" }
            ]
          },
          {
            name: "get_item_details",
            description: "Get detailed information for a specific item including metadata, abstract, attachments info, notes, and tags but not fulltext content. Returns: {key, title, creators, date, itemType, publicationTitle, volume, issue, pages, DOI, url, abstractNote, tags, notes: [note_content], attachments: [{key, title, path, contentType, filename, url, linkMode, hasFulltext, size}]}",
            category: "retrieval",
            parameters: {
              itemKey: { type: "string", description: "Unique item key", required: true }
            },
            examples: [
              { query: { itemKey: "ABCD1234" }, description: "Get item by key" }
            ]
          },
          {
            name: "get_annotation_by_id",
            description: "Get complete content of a specific annotation by ID",
            category: "retrieval",
            parameters: {
              annotationId: { type: "string", description: "Annotation ID", required: true }
            }
          },
          {
            name: "get_annotations_batch",
            description: "Get complete content of multiple annotations by IDs",
            category: "retrieval",
            parameters: {
              ids: {
                type: "array",
                items: { type: "string" },
                description: "Array of annotation IDs",
                required: true
              }
            }
          },
          {
            name: "get_item_pdf_content",
            description: "Extract text content from PDF attachments",
            category: "retrieval",
            parameters: {
              itemKey: { type: "string", description: "Item key", required: true },
              page: { type: "number", description: "Specific page number (optional)", required: false }
            }
          },
          {
            name: "get_collections",
            description: "Get list of all collections in the library",
            category: "collections",
            parameters: {
              limit: { type: "number", description: "Maximum results to return", required: false },
              offset: { type: "number", description: "Pagination offset", required: false }
            }
          },
          {
            name: "search_collections",
            description: "Search collections by name",
            category: "collections",
            parameters: {
              q: { type: "string", description: "Collection name search query", required: true },
              limit: { type: "number", description: "Maximum results to return", required: false }
            }
          },
          {
            name: "get_collection_details",
            description: "Get detailed information about a specific collection",
            category: "collections",
            parameters: {
              collectionKey: { type: "string", description: "Collection key", required: true }
            }
          },
          {
            name: "get_collection_items",
            description: "Get items in a specific collection",
            category: "collections",
            parameters: {
              collectionKey: { type: "string", description: "Collection key", required: true },
              limit: { type: "number", description: "Maximum results to return", required: false },
              offset: { type: "number", description: "Pagination offset", required: false }
            }
          },
          {
            name: "get_item_fulltext",
            description: "Get comprehensive fulltext content from item including attachments, notes, abstracts, and webpage snapshots. Returns: {itemKey, title, itemType, abstract, fulltext: {attachments: [{attachmentKey, filename, filePath, contentType, type, content, length, extractionMethod}], notes: [{noteKey, title, content, htmlContent, length, dateModified}], webpage: {url, filename, filePath, content, length, type}, total_length}, metadata: {extractedAt, sources}}",
            category: "fulltext",
            parameters: {
              itemKey: { type: "string", description: "Item key", required: true },
              attachments: { type: "boolean", description: "Include attachment content (default: true)", required: false },
              notes: { type: "boolean", description: "Include notes content (default: true)", required: false },
              webpage: { type: "boolean", description: "Include webpage snapshots (default: true)", required: false },
              abstract: { type: "boolean", description: "Include abstract (default: true)", required: false }
            },
            examples: [
              { query: { itemKey: "ABCD1234" }, description: "Get all fulltext content for an item" },
              { query: { itemKey: "ABCD1234", attachments: true, notes: false }, description: "Get only attachment content" }
            ]
          },
          {
            name: "get_attachment_content",
            description: "Extract text content from a specific attachment (PDF, HTML, text files). Returns: {attachmentKey, filename, filePath, contentType, type, content, length, extractionMethod, extractedAt}",
            category: "fulltext",
            parameters: {
              attachmentKey: { type: "string", description: "Attachment key", required: true },
              format: { type: "string", enum: ["json", "text"], description: "Response format (default: json)", required: false }
            }
          },
          {
            name: "search_fulltext",
            description: "Search within fulltext content of items with context and relevance scoring",
            category: "fulltext",
            parameters: {
              q: { type: "string", description: "Search query", required: true },
              itemKeys: { type: "array", items: { type: "string" }, description: "Limit search to specific items (optional)", required: false },
              contextLength: { type: "number", description: "Context length around matches (default: 200)", required: false },
              maxResults: { type: "number", description: "Maximum results to return (default: 50)", required: false },
              caseSensitive: { type: "boolean", description: "Case sensitive search (default: false)", required: false }
            },
            examples: [
              { query: { q: "machine learning" }, description: "Search for 'machine learning' in all fulltext" },
              { query: { q: "neural networks", maxResults: 10, contextLength: 100 }, description: "Limited context search" }
            ]
          },
          {
            name: "get_item_abstract",
            description: "Get the abstract/summary of a specific item",
            category: "retrieval",
            parameters: {
              itemKey: { type: "string", description: "Item key", required: true },
              format: { type: "string", enum: ["json", "text"], description: "Response format (default: json)", required: false }
            }
          }
        ],
        endpoints: {
          mcp: {
            "/mcp": {
              method: "POST",
              description: "MCP protocol endpoint for AI clients",
              contentType: "application/json",
              protocol: "MCP 2024-11-05"
            }
          },
          rest: {
            "/ping": {
              method: "GET",
              description: "Health check endpoint",
              response: "text/plain"
            },
            "/mcp/status": {
              method: "GET",
              description: "MCP server status and capabilities",
              response: "application/json"
            },
            "/capabilities": {
              method: "GET",
              description: "This endpoint - comprehensive API documentation",
              response: "application/json"
            },
            "/help": {
              method: "GET",
              description: "Alias for /capabilities",
              response: "application/json"
            },
            "/test/mcp": {
              method: "GET",
              description: "MCP integration testing endpoint",
              response: "application/json"
            }
          }
        },
        usage: {
          gettingStarted: {
            mcp: {
              description: "Connect via MCP protocol",
              steps: [
                "Configure MCP client to connect to this server",
                "Use streamable HTTP transport",
                "Send MCP requests to /mcp endpoint",
                "Available tools will be listed via tools/list method"
              ]
            },
            rest: {
              description: "Use REST API directly",
              examples: [
                "GET /capabilities - Get this documentation",
                "GET /ping - Health check",
                "GET /mcp/status - Check MCP server status"
              ]
            }
          },
          authentication: "None required for local connections",
          rateLimit: "No rate limiting currently implemented",
          cors: "CORS headers not currently set"
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: this.mcpServer ? "ready" : "mcp-disabled"
      };
    }
  };
  var httpServer = new HttpServer();

  // src/modules/serverPreferences.ts
  var PREFS_PREFIX = config.prefsPrefix;
  var MCP_SERVER_PORT = `${PREFS_PREFIX}.mcp.server.port`;
  var MCP_SERVER_ENABLED = `${PREFS_PREFIX}.mcp.server.enabled`;
  var ServerPreferences = class {
    observers = [];
    observerID = null;
    constructor() {
      this.initializeDefaults();
      this.register();
    }
    initializeDefaults() {
      this.logDiagnosticInfo();
      const currentPort = Zotero.Prefs.get(MCP_SERVER_PORT, true);
      const currentEnabled = Zotero.Prefs.get(MCP_SERVER_ENABLED, true);
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] Initial prefs - port: ${currentPort} (type: ${typeof currentPort}), enabled: ${currentEnabled} (type: ${typeof currentEnabled})`);
      }
      if (currentPort === void 0 || currentPort === null) {
        if (typeof ztoolkit !== "undefined") {
          ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] Setting default port: 23120`);
        }
        Zotero.Prefs.set(MCP_SERVER_PORT, 23120, true);
        const immediatePortCheck = Zotero.Prefs.get(MCP_SERVER_PORT, true);
        if (typeof ztoolkit !== "undefined") {
          ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] Port set, immediate check: ${immediatePortCheck}`);
        }
      }
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] About to check/set enabled state...`);
      }
      if (currentEnabled === void 0 || currentEnabled === null) {
        if (typeof ztoolkit !== "undefined") {
          ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] Setting default enabled state to true (was undefined/null)`);
        }
        Zotero.Prefs.set(MCP_SERVER_ENABLED, true, true);
        const immediateEnabledCheck = Zotero.Prefs.get(MCP_SERVER_ENABLED, true);
        if (typeof ztoolkit !== "undefined") {
          ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] Enabled set, immediate check: ${immediateEnabledCheck} (type: ${typeof immediateEnabledCheck})`);
        }
      } else if (currentEnabled === false) {
        if (typeof ztoolkit !== "undefined") {
          ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] Found enabled=false, investigating why...`);
          ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] Stack trace: ${new Error().stack}`);
        }
      }
      const verifyPort = Zotero.Prefs.get(MCP_SERVER_PORT, true);
      const verifyEnabled = Zotero.Prefs.get(MCP_SERVER_ENABLED, true);
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] After initialization - port: ${verifyPort}, enabled: ${verifyEnabled}`);
      }
      this.startPreferenceMonitoring();
    }
    logDiagnosticInfo() {
      if (typeof ztoolkit === "undefined") return;
      try {
        ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] Zotero version: ${Zotero.version || "unknown"}`);
        try {
          ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] Platform: ${globalThis.navigator?.platform || "unknown"}`);
        } catch (e) {
          ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] Platform info unavailable`);
        }
        if (typeof Zotero.test !== "undefined") {
          ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] Running in test mode`);
        }
        ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] Zotero.Prefs available: ${typeof Zotero.Prefs !== "undefined"}`);
        if (typeof Services !== "undefined" && Services.prefs) {
          ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] Services.prefs available: true`);
        } else {
          ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] Services.prefs available: false`);
        }
        ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] addon.data available: ${typeof addon !== "undefined" && typeof addon.data !== "undefined"}`);
      } catch (error) {
        ztoolkit.log(`[ServerPreferences] [DIAGNOSTIC] Error in diagnostic logging: ${error}`, "error");
      }
    }
    startPreferenceMonitoring() {
      if (typeof ztoolkit === "undefined") return;
      let monitorCount = 0;
      const maxMonitors = 12;
      const monitorInterval = setInterval(() => {
        monitorCount++;
        const currentEnabled = Zotero.Prefs.get(MCP_SERVER_ENABLED, true);
        const currentPort = Zotero.Prefs.get(MCP_SERVER_PORT, true);
        ztoolkit.log(`[ServerPreferences] [MONITOR-${monitorCount}] enabled: ${currentEnabled}, port: ${currentPort}`);
        if (currentEnabled === false) {
          ztoolkit.log(`[ServerPreferences] [MONITOR-${monitorCount}] WARNING: Server disabled! Investigating...`);
          try {
            const allPrefs = [];
            const prefService = typeof Services !== "undefined" && Services.prefs;
            if (prefService) {
              const prefKeys = prefService.getChildList(PREFS_PREFIX);
              prefKeys.forEach((key) => {
                const value = prefService.getPrefType(key) === prefService.PREF_BOOL ? prefService.getBoolPref(key) : prefService.getCharPref(key, "unknown");
                allPrefs.push(`${key}: ${value}`);
              });
              ztoolkit.log(`[ServerPreferences] [MONITOR-${monitorCount}] All plugin prefs: ${allPrefs.join(", ")}`);
            }
          } catch (error) {
            ztoolkit.log(`[ServerPreferences] [MONITOR-${monitorCount}] Error reading all prefs: ${error}`, "error");
          }
        }
        if (monitorCount >= maxMonitors) {
          clearInterval(monitorInterval);
          ztoolkit.log(`[ServerPreferences] [MONITOR] Monitoring completed after ${monitorCount} checks`);
        }
      }, 5e3);
    }
    getPort() {
      const DEFAULT_PORT = 23120;
      try {
        const port = Zotero.Prefs.get(MCP_SERVER_PORT, true);
        if (typeof Zotero !== "undefined" && Zotero.debug) {
          Zotero.debug(
            `[ServerPreferences] Raw port value from prefs: ${port} (type: ${typeof port})`
          );
        }
        if (port === void 0 || port === null || isNaN(Number(port))) {
          if (typeof Zotero !== "undefined" && Zotero.debug) {
            Zotero.debug(
              `[ServerPreferences] Port value invalid, using default: ${DEFAULT_PORT}`
            );
          }
          return DEFAULT_PORT;
        }
        return Number(port);
      } catch (error) {
        if (typeof Zotero !== "undefined" && Zotero.debug) {
          Zotero.debug(
            `[ServerPreferences] Error getting port: ${error}. Using default: ${DEFAULT_PORT}`
          );
        }
        return DEFAULT_PORT;
      }
    }
    isServerEnabled() {
      const DEFAULT_ENABLED = true;
      try {
        const enabled = Zotero.Prefs.get(MCP_SERVER_ENABLED, true);
        ztoolkit.log(`[ServerPreferences] Reading ${MCP_SERVER_ENABLED}: ${enabled} (type: ${typeof enabled})`);
        if (enabled === void 0 || enabled === null) {
          ztoolkit.log(`[ServerPreferences] Server enabled value invalid, using default: ${DEFAULT_ENABLED}`);
          return DEFAULT_ENABLED;
        }
        const result = Boolean(enabled);
        ztoolkit.log(`[ServerPreferences] isServerEnabled returning: ${result}`);
        return result;
      } catch (error) {
        ztoolkit.log(`[ServerPreferences] Error getting server enabled status: ${error}. Using default: ${DEFAULT_ENABLED}`);
        return DEFAULT_ENABLED;
      }
    }
    addObserver(observer) {
      this.observers.push(observer);
    }
    removeObserver(observer) {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    }
    register() {
      try {
        if (typeof ztoolkit !== "undefined") {
          ztoolkit.log(`[ServerPreferences] Registering observer for: ${MCP_SERVER_ENABLED}`);
        }
        this.observerID = Zotero.Prefs.registerObserver(
          MCP_SERVER_ENABLED,
          (name) => {
            if (typeof ztoolkit !== "undefined") {
              ztoolkit.log(`[ServerPreferences] Observer triggered for: ${name}`);
            }
            this.observers.forEach((observer) => observer(name));
          }
        );
        if (typeof ztoolkit !== "undefined") {
          ztoolkit.log(`[ServerPreferences] Observer registered with ID: ${this.observerID?.toString()}`);
        }
      } catch (error) {
        if (typeof ztoolkit !== "undefined") {
          ztoolkit.log(`[ServerPreferences] Error registering observer: ${error}`, "error");
        }
      }
    }
    unregister() {
      if (this.observerID) {
        Zotero.Prefs.unregisterObserver(this.observerID);
        this.observerID = null;
      }
      this.observers = [];
    }
  };
  var serverPreferences = new ServerPreferences();

  // src/utils/locale.ts
  function initLocale() {
    const l10n = new (typeof Localization === "undefined" ? ztoolkit.getGlobal("Localization") : Localization)([`${config.addonRef}-addon.ftl`], true);
    addon.data.locale = {
      current: l10n
    };
  }
  function getString(...inputs) {
    if (inputs.length === 1) {
      return _getString(inputs[0]);
    } else if (inputs.length === 2) {
      if (typeof inputs[1] === "string") {
        return _getString(inputs[0], { branch: inputs[1] });
      } else {
        return _getString(inputs[0], inputs[1]);
      }
    } else {
      throw new Error("Invalid arguments");
    }
  }
  function _getString(localeString, options = {}) {
    const localStringWithPrefix = `${config.addonRef}-${localeString}`;
    const { branch, args } = options;
    const pattern = addon.data.locale?.current.formatMessagesSync([
      { id: localStringWithPrefix, args }
    ])[0];
    if (!pattern) {
      return localStringWithPrefix;
    }
    if (branch && pattern.attributes) {
      for (const attr of pattern.attributes) {
        if (attr.name === branch) {
          return attr.value;
        }
      }
      return pattern.attributes[branch] || localStringWithPrefix;
    } else {
      return pattern.value || localStringWithPrefix;
    }
  }

  // src/modules/examples.ts
  var BasicExampleFactory = class {
    static registerPrefs() {
      Zotero.PreferencePanes.register({
        pluginID: addon.data.config.addonID,
        src: rootURI + "content/preferences.xhtml",
        label: getString("prefs-title"),
        image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`
      });
    }
  };

  // src/modules/clientConfigGenerator.ts
  var ClientConfigGenerator = class {
    static CLIENT_CONFIGS = [
      {
        name: "claude-code",
        displayName: "Claude Code",
        description: "Anthropic's Claude Code CLI tool",
        configTemplate: (port, serverName = "zotero-mcp") => ({
          mcpServers: {
            [serverName]: {
              serverUrl: `http://127.0.0.1:${port}/mcp`,
              headers: {
                "Content-Type": "application/json",
                "User-Agent": "Claude-Code-MCP-Client"
              }
            }
          }
        }),
        getInstructions: (port = 23120) => [
          "1. Use Claude Code's built-in command to add the MCP server:",
          `   claude mcp add zotero-mcp http://127.0.0.1:${port}/mcp -t http`,
          "",
          "2. Alternatively, add with custom headers:",
          `   claude mcp add zotero-mcp http://127.0.0.1:${port}/mcp -t http \\`,
          "     -H 'Content-Type: application/json' \\",
          "     -H 'User-Agent: Claude-Code-MCP-Client'",
          "",
          "3. Verify the server was added and connected:",
          "   claude mcp list",
          "",
          "4. Available MCP tools in Claude Code:",
          "   - search_library: Search your Zotero library",
          "   - get_annotations: Get annotations and notes",
          "   - get_content: Extract full content from PDFs",
          "   - get_collections: Browse your collections",
          "   - search_fulltext: Search full document content",
          "   - And 6 more research tools!",
          "",
          "5. Start using the tools immediately - no restart required!",
          "",
          "Note: Ensure Zotero is running and the MCP plugin server is enabled",
          "",
          "Troubleshooting for Proxy Users:",
          "- If using VPN/proxy with TUN mode, add 127.0.0.1 to bypass list",
          "- Or temporarily disable TUN mode for local development",
          "- Configuration uses 127.0.0.1 instead of localhost for better proxy compatibility"
        ]
      },
      {
        name: "claude-desktop",
        displayName: "Claude Desktop",
        description: "Anthropic's Claude Desktop application",
        configTemplate: (port, serverName = "zotero-mcp") => ({
          mcpServers: {
            [serverName]: {
              command: "npx",
              args: ["mcp-remote", `http://127.0.0.1:${port}/mcp`],
              env: {}
            }
          }
        }),
        getInstructions: () => getString("claude-desktop-instructions").split("\n").filter((s) => s.trim())
      },
      {
        name: "cline-vscode",
        displayName: "Cline (VS Code)",
        description: "Cline extension for Visual Studio Code",
        configTemplate: (port, serverName = "zotero-mcp") => ({
          mcpServers: {
            [serverName]: {
              command: "npx",
              args: ["mcp-remote", `http://127.0.0.1:${port}/mcp`],
              env: {},
              alwaysAllow: ["*"],
              disabled: false
            }
          }
        }),
        getInstructions: () => getString("cline-vscode-instructions").split("\n").filter((s) => s.trim())
      },
      {
        name: "continue-dev",
        displayName: "Continue.dev",
        description: "Continue coding assistant",
        configTemplate: (port, serverName = "zotero-mcp") => ({
          experimental: {
            modelContextProtocolServers: [
              {
                name: serverName,
                transport: {
                  type: "stdio",
                  command: "npx",
                  args: ["mcp-remote", `http://127.0.0.1:${port}/mcp`]
                }
              }
            ]
          }
        }),
        getInstructions: () => getString("continue-dev-instructions").split("\n").filter((s) => s.trim())
      },
      {
        name: "cursor",
        displayName: "Cursor",
        description: "AI-powered code editor",
        configTemplate: (port, serverName = "zotero-mcp") => ({
          mcpServers: {
            [serverName]: {
              command: "npx",
              args: ["mcp-remote", `http://127.0.0.1:${port}/mcp`],
              env: {}
            }
          }
        }),
        getInstructions: () => getString("cursor-instructions").split("\n").filter((s) => s.trim())
      },
      {
        name: "cherry-studio",
        displayName: "Cherry Studio",
        description: "AI assistant desktop application",
        configTemplate: (port, serverName = "zotero-mcp") => ({
          mcpServers: {
            [serverName]: {
              type: "streamableHttp",
              url: `http://127.0.0.1:${port}/mcp`,
              headers: {
                "Content-Type": "application/json"
              }
            }
          }
        }),
        getInstructions: () => getString("cherry-studio-instructions").split("\n").filter((s) => s.trim())
      },
      {
        name: "gemini-cli",
        displayName: "Gemini CLI",
        description: "Google Gemini command line interface",
        configTemplate: (port, serverName = "zotero-mcp") => ({
          mcpServers: {
            [serverName]: {
              httpUrl: `http://127.0.0.1:${port}/mcp`,
              headers: {
                "Content-Type": "application/json"
              },
              timeout: 6e4,
              trust: true
            }
          }
        }),
        getInstructions: () => getString("gemini-cli-instructions").split("\n").filter((s) => s.trim())
      },
      {
        name: "chatbox",
        displayName: "Chatbox",
        description: "Desktop AI chat application",
        configTemplate: (port, serverName = "zotero-mcp") => ({
          mcpServers: {
            [serverName]: {
              command: "npx",
              args: ["mcp-remote", `http://127.0.0.1:${port}/mcp`],
              env: {}
            }
          }
        }),
        getInstructions: () => getString("chatbox-instructions").split("\n").filter((s) => s.trim())
      },
      {
        name: "trae-ai",
        displayName: "Trae AI",
        description: "AI-powered development assistant",
        configTemplate: (port, serverName = "zotero-mcp") => ({
          mcpServers: {
            [serverName]: {
              command: "npx",
              args: ["mcp-remote", `http://127.0.0.1:${port}/mcp`],
              env: {}
            }
          }
        }),
        getInstructions: () => getString("trae-ai-instructions").split("\n").filter((s) => s.trim())
      },
      {
        name: "qwen-code",
        displayName: "Qwen Code",
        description: "Qwen Code CLI - AI-powered coding assistant",
        configTemplate: (port, serverName = "zotero-mcp") => ({
          mcpServers: {
            [serverName]: {
              command: "npx",
              args: ["mcp-remote", `http://127.0.0.1:${port}/mcp`],
              env: {}
            }
          }
        }),
        getInstructions: (port = 23120) => [
          "1. Use Qwen Code's MCP add command:",
          `   qwen mcp add zotero-mcp http://127.0.0.1:${port}/mcp -t http`,
          "",
          "2. Alternatively, add with custom headers and options:",
          `   qwen mcp add zotero-mcp http://127.0.0.1:${port}/mcp \\`,
          "     -t http \\",
          "     -H 'Content-Type: application/json' \\",
          "     -H 'User-Agent: Qwen-Code-MCP-Client' \\",
          "     --trust",
          "",
          "3. Verify the server was added:",
          "   qwen mcp list",
          "",
          "4. Available MCP tools in Qwen Code:",
          "   - search_library: Search your Zotero library",
          "   - get_annotations: Get annotations and notes",
          "   - get_content: Extract full content from PDFs",
          "   - get_collections: Browse your collections",
          "   - search_fulltext: Search full document content",
          "   - And 6 more research tools!",
          "",
          "5. Start using the tools with @ syntax:",
          '   Example: /analyze @zotero:search_library term:"machine learning"',
          "",
          "6. Use /mcp command to verify MCP server is active",
          "",
          "Note: Ensure Zotero is running and the MCP plugin server is enabled",
          "",
          "Configuration file location: ~/.qwen/settings.json or .qwen/settings.json",
          "",
          "Troubleshooting:",
          "- If connection fails, check server status with 'qwen mcp list'",
          "- Use --trust flag to bypass tool call confirmation prompts",
          "- Configuration uses 127.0.0.1 instead of localhost for better compatibility"
        ]
      },
      {
        name: "custom-http",
        displayName: "\u81EA\u5B9A\u4E49 HTTP \u5BA2\u6237\u7AEF",
        description: "\u901A\u7528 HTTP MCP \u5BA2\u6237\u7AEF\u914D\u7F6E",
        configTemplate: (port, serverName = "zotero-mcp") => ({
          name: serverName,
          description: "Zotero MCP Server - Research management and citation tools",
          transport: {
            type: "http",
            endpoint: `http://127.0.0.1:${port}/mcp`,
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            }
          },
          capabilities: {
            tools: true,
            resources: false,
            prompts: false
          },
          connectionTest: `curl -X POST http://127.0.0.1:${port}/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"ping","params":{}}'`
        }),
        getInstructions: () => getString("custom-http-instructions").split("\n").filter((s) => s.trim())
      }
    ];
    static getAvailableClients() {
      return this.CLIENT_CONFIGS;
    }
    static generateConfig(clientName, port, serverName) {
      const client = this.CLIENT_CONFIGS.find((c) => c.name === clientName);
      if (!client) {
        throw new Error(`Unsupported client: ${clientName}`);
      }
      const config2 = client.configTemplate(port, serverName || "zotero-mcp");
      return JSON.stringify(config2, null, 2);
    }
    static getInstructions(clientName, port) {
      const client = this.CLIENT_CONFIGS.find((c) => c.name === clientName);
      return client?.getInstructions?.(port) || [];
    }
    static generateFullGuide(clientName, port, serverName) {
      const client = this.CLIENT_CONFIGS.find((c) => c.name === clientName);
      if (!client) {
        throw new Error(`Unsupported client: ${clientName}`);
      }
      const config2 = this.generateConfig(clientName, port, serverName);
      const instructions = this.getInstructions(clientName, port);
      const actualServerName = serverName || "zotero-mcp";
      return `${getString("config-guide-header", { args: { clientName: client.displayName } })}

${getString("config-guide-server-info")}
${getString("config-guide-server-name", { args: { serverName: actualServerName } })}
${getString("config-guide-server-port", { args: { port: port.toString() } })}
${getString("config-guide-server-endpoint", { args: { port: port.toString() } })}

${getString("config-guide-json-header")}
\`\`\`json
${config2}
\`\`\`

${getString("config-guide-steps-header")}
${instructions.map((instruction) => instruction).join("\n")}

${getString("config-guide-tools-header")}
${getString("config-guide-tools-list")}

${getString("config-guide-troubleshooting-header")}
${getString("config-guide-troubleshooting-list")}

${getString("config-guide-generated-time", { args: { time: (/* @__PURE__ */ new Date()).toLocaleString() } })}
`;
    }
    static async copyToClipboard(text) {
      try {
        if (typeof Zotero !== "undefined" && Zotero.Utilities && Zotero.Utilities.Internal && Zotero.Utilities.Internal.copyTextToClipboard) {
          Zotero.Utilities.Internal.copyTextToClipboard(text);
          return true;
        }
        const globalNav = globalThis.navigator;
        if (globalNav && globalNav.clipboard) {
          await globalNav.clipboard.writeText(text);
          return true;
        }
        if (typeof ztoolkit !== "undefined" && ztoolkit.getGlobal) {
          const globalWindow = ztoolkit.getGlobal("window");
          if (globalWindow && globalWindow.document) {
            const textArea = globalWindow.document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            globalWindow.document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const result = globalWindow.document.execCommand("copy");
            globalWindow.document.body.removeChild(textArea);
            return result;
          }
        }
        return false;
      } catch (error) {
        ztoolkit.log(`[ClientConfigGenerator] Failed to copy to clipboard: ${error}`, "error");
        return false;
      }
    }
  };

  // src/modules/preferenceScript.ts
  async function registerPrefsScripts(_window) {
    ztoolkit.log(`[PreferenceScript] [DIAGNOSTIC] Registering preference scripts...`);
    addon.data.prefs = { window: _window };
    try {
      const currentEnabled = Zotero.Prefs.get("extensions.zotero.zotero-mcp-ext.mcp.server.enabled", true);
      const currentPort = Zotero.Prefs.get("extensions.zotero.zotero-mcp-ext.mcp.server.port", true);
      ztoolkit.log(`[PreferenceScript] [DIAGNOSTIC] Current preferences - enabled: ${currentEnabled}, port: ${currentPort}`);
      const doc = _window.document;
      ztoolkit.log(`[PreferenceScript] [DIAGNOSTIC] Document available: ${!!doc}`);
      if (doc) {
        const prefElements = doc.querySelectorAll("[preference]");
        ztoolkit.log(`[PreferenceScript] [DIAGNOSTIC] Found ${prefElements.length} preference-bound elements`);
        const serverEnabledElement = doc.querySelector("#zotero-prefpane-zotero-mcp-ext-mcp-server-enabled");
        if (serverEnabledElement) {
          ztoolkit.log(`[PreferenceScript] [DIAGNOSTIC] Server enabled element found, initial checked state: ${serverEnabledElement.hasAttribute("checked")}`);
        } else {
          ztoolkit.log(`[PreferenceScript] [DIAGNOSTIC] WARNING: Server enabled element NOT found`);
        }
      }
    } catch (error) {
      ztoolkit.log(`[PreferenceScript] [DIAGNOSTIC] Error in preference diagnostic: ${error}`, "error");
    }
    bindPrefEvents();
  }
  function bindPrefEvents() {
    const doc = addon.data.prefs.window.document;
    const serverEnabledCheckbox = doc?.querySelector(
      `#zotero-prefpane-${config.addonRef}-mcp-server-enabled`
    );
    if (serverEnabledCheckbox) {
      const currentEnabled = Zotero.Prefs.get("extensions.zotero.zotero-mcp-ext.mcp.server.enabled", true);
      if (currentEnabled !== false) {
        serverEnabledCheckbox.setAttribute("checked", "true");
      } else {
        serverEnabledCheckbox.removeAttribute("checked");
      }
      ztoolkit.log(`[PreferenceScript] Initialized checkbox state: ${currentEnabled}`);
      serverEnabledCheckbox.addEventListener("command", (event) => {
        const checkbox = event.target;
        const checked = checkbox.hasAttribute("checked");
        ztoolkit.log(`[PreferenceScript] Checkbox command event - checked: ${checked}`);
        Zotero.Prefs.set("extensions.zotero.zotero-mcp-ext.mcp.server.enabled", checked, true);
        ztoolkit.log(`[PreferenceScript] Updated preference to: ${checked}`);
        const verify = Zotero.Prefs.get("extensions.zotero.zotero-mcp-ext.mcp.server.enabled", true);
        ztoolkit.log(`[PreferenceScript] Verified preference value: ${verify}`);
        try {
          const httpServer3 = addon.data.httpServer;
          if (httpServer3) {
            if (checked) {
              ztoolkit.log(`[PreferenceScript] Starting server manually...`);
              if (!httpServer3.isServerRunning()) {
                const portPref = Zotero.Prefs.get("extensions.zotero.zotero-mcp-ext.mcp.server.port", true);
                const port = typeof portPref === "number" ? portPref : 23120;
                httpServer3.start(port);
                ztoolkit.log(`[PreferenceScript] Server started on port ${port}`);
              }
            } else {
              ztoolkit.log(`[PreferenceScript] Stopping server manually...`);
              if (httpServer3.isServerRunning()) {
                httpServer3.stop();
                ztoolkit.log(`[PreferenceScript] Server stopped`);
              }
            }
          }
        } catch (error) {
          ztoolkit.log(`[PreferenceScript] Error controlling server: ${error}`, "error");
        }
      });
      serverEnabledCheckbox.addEventListener("click", (event) => {
        const checkbox = event.target;
        ztoolkit.log(`[PreferenceScript] Checkbox clicked - hasAttribute('checked'): ${checkbox.hasAttribute("checked")}`);
        setTimeout(() => {
          ztoolkit.log(`[PreferenceScript] Checkbox state after click: ${checkbox.hasAttribute("checked")}`);
        }, 10);
      });
    }
    const portInput = doc?.querySelector(
      `#zotero-prefpane-${config.addonRef}-mcp-server-port`
    );
    portInput?.addEventListener("change", () => {
      if (portInput) {
        const port = parseInt(portInput.value, 10);
        if (isNaN(port) || port < 1024 || port > 65535) {
          addon.data.prefs.window.alert(
            getString("pref-server-port-invalid")
          );
          const originalPort = Zotero.Prefs.get("extensions.zotero.zotero-mcp-ext.mcp.server.port", true) || 23120;
          portInput.value = originalPort.toString();
        }
      }
    });
    const clientSelect = doc?.querySelector("#client-type-select");
    const serverNameInput = doc?.querySelector("#server-name-input");
    const generateButton = doc?.querySelector("#generate-config-button");
    const copyConfigButton = doc?.querySelector("#copy-config-button");
    const configOutput = doc?.querySelector("#config-output");
    const configGuide = doc?.querySelector("#config-guide");
    let currentConfig = "";
    let currentGuide = "";
    generateButton?.addEventListener("click", () => {
      try {
        const clientType = clientSelect?.value || "claude-desktop";
        const serverName = serverNameInput?.value?.trim() || "zotero-mcp";
        const port = parseInt(portInput?.value || "23120", 10);
        currentConfig = ClientConfigGenerator.generateConfig(clientType, port, serverName);
        currentGuide = ClientConfigGenerator.generateFullGuide(clientType, port, serverName);
        configOutput.value = currentConfig;
        displayGuideInArea(currentGuide);
        copyConfigButton.disabled = false;
        ztoolkit.log(`[PreferenceScript] Generated config for ${clientType}`);
      } catch (error) {
        addon.data.prefs.window.alert(`\u914D\u7F6E\u751F\u6210\u5931\u8D25: ${error}`);
        ztoolkit.log(`[PreferenceScript] Config generation failed: ${error}`, "error");
      }
    });
    copyConfigButton?.addEventListener("click", async () => {
      try {
        const success = await ClientConfigGenerator.copyToClipboard(currentConfig);
        if (success) {
          const originalText = copyConfigButton.textContent;
          copyConfigButton.textContent = "\u5DF2\u590D\u5236!";
          copyConfigButton.style.backgroundColor = "#4CAF50";
          setTimeout(() => {
            copyConfigButton.textContent = originalText;
            copyConfigButton.style.backgroundColor = "";
          }, 2e3);
        } else {
          configOutput.select();
          configOutput.focus();
          addon.data.prefs.window.alert("\u81EA\u52A8\u590D\u5236\u5931\u8D25\uFF0C\u5DF2\u9009\u4E2D\u6587\u672C\uFF0C\u8BF7\u4F7F\u7528 Ctrl+C \u624B\u52A8\u590D\u5236");
        }
      } catch (error) {
        configOutput.select();
        configOutput.focus();
        addon.data.prefs.window.alert(`\u590D\u5236\u5931\u8D25\uFF0C\u5DF2\u9009\u4E2D\u6587\u672C\uFF0C\u8BF7\u4F7F\u7528 Ctrl+C \u624B\u52A8\u590D\u5236
\u9519\u8BEF: ${error}`);
        ztoolkit.log(`[PreferenceScript] Copy failed: ${error}`, "error");
      }
    });
    function displayGuideInArea(guide) {
      if (!configGuide) return;
      try {
        configGuide.textContent = guide;
        configGuide.style.whiteSpace = "pre-wrap";
        configGuide.style.fontFamily = "monospace, 'Courier New', Courier";
      } catch (error) {
        ztoolkit.log(`[PreferenceScript] Error displaying guide: ${error}`, "error");
        configGuide.textContent = "\u914D\u7F6E\u6307\u5357\u663E\u793A\u51FA\u9519\uFF0C\u8BF7\u5C1D\u8BD5\u91CD\u65B0\u751F\u6210\u914D\u7F6E\u3002";
      }
    }
    clientSelect?.addEventListener("change", () => {
      if (currentConfig) {
        generateButton?.click();
      }
    });
    serverNameInput?.addEventListener("input", () => {
      if (currentConfig) {
        generateButton?.click();
      }
    });
  }

  // src/utils/ztoolkit.ts
  function createZToolkit() {
    const _ztoolkit = new ZoteroToolkit();
    initZToolkit(_ztoolkit);
    return _ztoolkit;
  }
  function initZToolkit(_ztoolkit) {
    const env = "production";
    _ztoolkit.basicOptions.log.prefix = `[${config.addonName}]`;
    _ztoolkit.basicOptions.log.disableConsole = env === "production";
    _ztoolkit.UI.basicOptions.ui.enableElementJSONLog = false;
    _ztoolkit.UI.basicOptions.ui.enableElementDOMLog = false;
    _ztoolkit.basicOptions.api.pluginID = config.addonID;
    _ztoolkit.ProgressWindow.setIconURI(
      "default",
      `chrome://${config.addonRef}/content/icons/favicon.png`
    );
  }

  // src/hooks.ts
  init_mcpSettingsService();
  async function onStartup() {
    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise
    ]);
    initLocale();
    try {
      MCPSettingsService.initializeDefaults();
      ztoolkit.log(`===MCP=== [hooks.ts] MCP settings initialized successfully`);
    } catch (error) {
      ztoolkit.log(`===MCP=== [hooks.ts] Error initializing MCP settings: ${error}`, "error");
    }
    checkFirstInstallation();
    try {
      ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] Starting server initialization...`);
      ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] Zotero version: ${Zotero.version || "unknown"}`);
      try {
        ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] Platform: ${globalThis.navigator?.platform || "unknown"}`);
        ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] User agent: ${globalThis.navigator?.userAgent || "unknown"}`);
      } catch (e) {
        ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] Platform info unavailable`);
      }
      ztoolkit.log(`===MCP=== [hooks.ts] Attempting to get server preferences...`);
      const port = serverPreferences.getPort();
      const enabled = serverPreferences.isServerEnabled();
      ztoolkit.log(
        `===MCP=== [hooks.ts] Port retrieved: ${port} (type: ${typeof port})`
      );
      ztoolkit.log(`===MCP=== [hooks.ts] Server enabled: ${enabled} (type: ${typeof enabled})`);
      try {
        const directEnabled = Zotero.Prefs.get("extensions.zotero.zotero-mcp-ext.mcp.server.enabled", true);
        const directPort = Zotero.Prefs.get("extensions.zotero.zotero-mcp-ext.mcp.server.port", true);
        ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] Direct pref check - enabled: ${directEnabled}, port: ${directPort}`);
        if (enabled !== directEnabled) {
          ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] WARNING: Enabled state mismatch! serverPreferences: ${enabled}, direct: ${directEnabled}`);
        }
      } catch (error) {
        ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] Error in direct preference check: ${error}`, "error");
      }
      if (enabled === false) {
        ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] Server is disabled - investigating reason...`);
        const hasBeenEnabled = Zotero.Prefs.get("extensions.zotero.zotero-mcp-ext.debug.hasBeenEnabled", false);
        if (!hasBeenEnabled) {
          ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] First time setup - server was never enabled before`);
        } else {
          ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] WARNING: Server was previously enabled but is now disabled!`);
        }
        ztoolkit.log(`===MCP=== [hooks.ts] Server is disabled, skipping startup \u63D2\u4EF6\u65E0\u6CD5\u542F\u52A8`);
        return;
      }
      Zotero.Prefs.set("extensions.zotero.zotero-mcp-ext.debug.hasBeenEnabled", true, true);
      if (!port || isNaN(port)) {
        throw new Error(`Invalid port value: ${port}`);
      }
      ztoolkit.log(
        `===MCP=== [hooks.ts] Starting HTTP server on port ${port}...`
      );
      httpServer.start(port);
      addon.data.httpServer = httpServer;
      ztoolkit.log(
        `===MCP=== [hooks.ts] HTTP server start initiated on port ${port}`
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      ztoolkit.log(
        `===MCP=== [hooks.ts] Failed to start HTTP server: ${err.message}`,
        "error"
      );
      Zotero.debug(
        `===MCP=== [hooks.ts] Server start error details: ${err.stack}`
      );
    }
    serverPreferences.addObserver(async (name) => {
      ztoolkit.log(`[MCP Plugin] Preference changed: ${name}`);
      if (name === "extensions.zotero.zotero-mcp-ext.mcp.server.port" || name === "extensions.zotero.zotero-mcp-ext.mcp.server.enabled") {
        try {
          if (httpServer.isServerRunning()) {
            ztoolkit.log("[MCP Plugin] Stopping HTTP server for restart...");
            httpServer.stop();
            ztoolkit.log("[MCP Plugin] HTTP server stopped");
          }
          if (serverPreferences.isServerEnabled()) {
            const port = serverPreferences.getPort();
            ztoolkit.log(
              `[MCP Plugin] Restarting HTTP server on port ${port}...`
            );
            httpServer.start(port);
            ztoolkit.log(
              `[MCP Plugin] HTTP server restarted successfully on port ${port}`
            );
          } else {
            ztoolkit.log("[MCP Plugin] HTTP server disabled by user preference");
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          ztoolkit.log(
            `[MCP Plugin] Error handling preference change: ${err.message}`,
            "error"
          );
        }
      }
    });
    BasicExampleFactory.registerPrefs();
    await Promise.all(
      Zotero.getMainWindows().map((win) => onMainWindowLoad(win))
    );
    addon.data.initialized = true;
  }
  async function onMainWindowLoad(win) {
    addon.data.ztoolkit = createZToolkit();
    win.MozXULElement.insertFTLIfNeeded(
      `${addon.data.config.addonRef}-mainWindow.ftl`
    );
    win.MozXULElement.insertFTLIfNeeded(
      `${addon.data.config.addonRef}-addon.ftl`
    );
    win.MozXULElement.insertFTLIfNeeded(
      `${addon.data.config.addonRef}-preferences.ftl`
    );
  }
  async function onMainWindowUnload(win) {
    ztoolkit.unregisterAll();
  }
  function onShutdown() {
    ztoolkit.log("[MCP Plugin] Shutting down...");
    try {
      if (httpServer.isServerRunning()) {
        httpServer.stop();
        ztoolkit.log("[MCP Plugin] HTTP server stopped during shutdown");
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      ztoolkit.log(
        `[MCP Plugin] Error stopping server during shutdown: ${err.message}`,
        "error"
      );
    }
    serverPreferences.unregister();
    ztoolkit.unregisterAll();
    addon.data.alive = false;
    delete Zotero[addon.data.config.addonInstance];
  }
  async function onNotify(event, type, ids, extraData) {
    ztoolkit.log("notify", event, type, ids, extraData);
  }
  async function onPrefsEvent(type, data) {
    ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] Preferences event: ${type}`);
    switch (type) {
      case "load":
        ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] Loading preference scripts...`);
        try {
          if (data.window) {
            ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] Preference window available`);
            const currentEnabled = Zotero.Prefs.get("extensions.zotero.zotero-mcp-ext.mcp.server.enabled", true);
            const currentPort = Zotero.Prefs.get("extensions.zotero.zotero-mcp-ext.mcp.server.port", true);
            ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] Current prefs at panel load - enabled: ${currentEnabled}, port: ${currentPort}`);
            setTimeout(() => {
              try {
                const doc = data.window.document;
                const enabledElement = doc?.querySelector("#zotero-prefpane-zotero-mcp-ext-mcp-server-enabled");
                const portElement = doc?.querySelector("#zotero-prefpane-zotero-mcp-ext-mcp-server-port");
                ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] Preference elements - enabled: ${!!enabledElement}, port: ${!!portElement}`);
                if (enabledElement) {
                  const hasChecked = enabledElement.hasAttribute("checked");
                  ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] Enabled checkbox state: ${hasChecked}`);
                }
              } catch (error) {
                ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] Error checking preference elements: ${error}`, "error");
              }
            }, 500);
          } else {
            ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] WARNING: No preference window in data`, "error");
          }
        } catch (error) {
          ztoolkit.log(`===MCP=== [hooks.ts] [DIAGNOSTIC] Error in preference load diagnostic: ${error}`, "error");
        }
        registerPrefsScripts(data.window);
        break;
      default:
        return;
    }
  }
  function checkFirstInstallation() {
    try {
      const hasShownPrompt = Zotero.Prefs.get("mcp.firstInstallPromptShown", false);
      if (!hasShownPrompt) {
        Zotero.Prefs.set("mcp.firstInstallPromptShown", true);
        setTimeout(() => {
          showFirstInstallPrompt();
        }, 3e3);
      }
    } catch (error) {
      ztoolkit.log(`[MCP Plugin] Error checking first installation: ${error}`, "error");
    }
  }
  function showFirstInstallPrompt() {
    try {
      const title = "\u6B22\u8FCE\u4F7F\u7528 Zotero MCP \u63D2\u4EF6 / Welcome to Zotero MCP Plugin";
      const promptText = "\u611F\u8C22\u5B89\u88C5 Zotero MCP \u63D2\u4EF6\uFF01\u4E3A\u4E86\u5F00\u59CB\u4F7F\u7528\uFF0C\u60A8\u9700\u8981\u4E3A\u60A8\u7684 AI \u5BA2\u6237\u7AEF\u751F\u6210\u914D\u7F6E\u6587\u4EF6\u3002\u662F\u5426\u73B0\u5728\u6253\u5F00\u8BBE\u7F6E\u9875\u9762\u6765\u751F\u6210\u914D\u7F6E\uFF1F\n\nThank you for installing the Zotero MCP Plugin! To get started, you need to generate configuration files for your AI clients. Would you like to open the settings page now to generate configurations?";
      const openPrefsText = "\u6253\u5F00\u8BBE\u7F6E / Open Settings";
      const laterText = "\u7A0D\u540E\u914D\u7F6E / Configure Later";
      const message = `${title}

${promptText}

${openPrefsText} (OK) / ${laterText} (Cancel)`;
      const mainWindow = Zotero.getMainWindow();
      if (!mainWindow) {
        ztoolkit.log("[MCP Plugin] No main window available", "error");
        return;
      }
      const result = mainWindow.confirm(message);
      if (result) {
        setTimeout(() => {
          openPreferencesWindow();
        }, 100);
      }
    } catch (error) {
      ztoolkit.log(`[MCP Plugin] Error showing first install prompt: ${error}`, "error");
    }
  }
  function openPreferencesWindow() {
    try {
      const windowName = `${addon.data.config.addonRef}-preferences`;
      const existingWindow = Zotero.getMainWindow().ZoteroPane.openPreferences(null, windowName);
      if (existingWindow) {
        existingWindow.focus();
      }
    } catch (error) {
      ztoolkit.log(`[MCP Plugin] Error opening preferences: ${error}`, "error");
      try {
        Zotero.getMainWindow().openPreferences();
      } catch (fallbackError) {
        ztoolkit.log(`[MCP Plugin] Fallback preferences open failed: ${fallbackError}`, "error");
      }
    }
  }
  var hooks_default = {
    onStartup,
    onShutdown,
    onMainWindowLoad,
    onMainWindowUnload,
    onNotify,
    onPrefsEvent
  };

  // src/addon.ts
  var Addon = class {
    data;
    // Lifecycle hooks
    hooks;
    // APIs
    api;
    constructor() {
      this.data = {
        alive: true,
        config,
        env: "production",
        initialized: false,
        ztoolkit: createZToolkit()
      };
      this.hooks = hooks_default;
      this.api = {
        HttpServer,
        // Expose the class for static methods
        testServer: () => {
          Zotero.debug("===MCP=== Manually testing server...");
          HttpServer.testServer();
        },
        startServer: () => {
          Zotero.debug("===MCP=== Manually starting server...");
          addon.data.httpServer?.start(serverPreferences.getPort());
        },
        stopServer: () => {
          Zotero.debug("===MCP=== Manually stopping server...");
          addon.data.httpServer?.stop();
        }
      };
    }
  };
  var addon_default = Addon;

  // src/index.ts
  var basicTool2 = new BasicTool();
  if (!basicTool2.getGlobal("Zotero")[config.addonInstance]) {
    _globalThis.addon = new addon_default();
    defineGlobal("ztoolkit", () => {
      return _globalThis.addon.data.ztoolkit;
    });
    Zotero[config.addonInstance] = addon;
  }
  function defineGlobal(name, getter) {
    Object.defineProperty(_globalThis, name, {
      get() {
        return getter ? getter() : basicTool2.getGlobal(name);
      }
    });
  }
})();
