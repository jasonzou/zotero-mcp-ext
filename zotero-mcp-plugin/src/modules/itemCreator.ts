import { RetrievedMetadata } from "./zoteroMetadataRetriever";
import { PDFMetadata } from "./pdfProcessor";

declare const Zotero: any;
declare const ztoolkit: ZToolkit;

/**
 * Zotero条目创建器
 * 提供创建和更新Zotero条目的功能
 */
export class ItemCreator {
  /**
   * 从PDF创建新的Zotero条目
   * @param pdfPath PDF文件路径
   * @param collectionKey 可选的集合键
   * @param metadata 元数据（来自web服务或PDF属性）
   * @returns 创建的条目信息
   */
  async createItemFromPDF(
    pdfPath: string,
    collectionKey?: string,
    metadata?: Partial<RetrievedMetadata>,
    pdfMetadata?: PDFMetadata,
  ): Promise<CreatedItemInfo> {
    try {
      ztoolkit.log("[ItemCreator] 创建条目从PDF:", { pdfPath, collectionKey });

      // 确定条目类型
      const itemType = metadata?.itemType || "document";

      // 创建新条目
      const item = new Zotero.Item(itemType);
      item.libraryID = Zotero.Libraries.userLibraryID;

      const fieldsSet: string[] = [];
      const metadataSources: MetadataSources = {
        webService: [],
        pdfProperties: [],
        manual: [],
      };

      // 设置元数据字段（web服务优先）
      if (metadata) {
        this.setItemFields(
          item,
          metadata,
          fieldsSet,
          metadataSources.webService,
        );
      }

      // 如果web服务没有提供某些字段，使用PDF属性
      if (pdfMetadata) {
        this.setPDFFields(
          item,
          pdfMetadata,
          fieldsSet,
          metadataSources.pdfProperties,
        );
      }

      // 如果仍然没有标题，使用文件名
      if (!item.getField("title")) {
        const filename =
          pdfPath.split("/").pop()?.replace(".pdf", "") || "Untitled";
        item.setField("title", filename);
        fieldsSet.push("title");
        metadataSources.manual.push("title");
      }

      // 保存条目
      const itemID = await item.saveTx();
      ztoolkit.log("[ItemCreator] 条目已创建:", { itemID, itemKey: item.key });

      // 附加PDF文件
      let attachmentKey: string | undefined;
      try {
        const attachment = await Zotero.Attachments.importFromFile({
          file: pdfPath,
          parentItemID: itemID,
        });
        attachmentKey = attachment.key;
        ztoolkit.log("[ItemCreator] PDF已附加:", { attachmentKey });
      } catch (error) {
        ztoolkit.log("[ItemCreator] PDF附加失败:", error, "error");
      }

      // 添加到集合（如果指定）
      if (collectionKey) {
        try {
          const collection = Zotero.Collections.getByLibraryAndKey(
            Zotero.Libraries.userLibraryID,
            collectionKey,
          );
          if (collection) {
            await collection.addItem(itemID);
            ztoolkit.log("[ItemCreator] 已添加到集合:", { collectionKey });
          }
        } catch (error) {
          ztoolkit.log("[ItemCreator] 添加到集合失败:", error, "error");
        }
      }

      return {
        itemKey: item.key,
        itemID,
        fieldsSet,
        attachmentKey,
        metadataSources,
      };
    } catch (error) {
      ztoolkit.log("[ItemCreator] 创建条目失败:", error, "error");
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
  async enrichExistingItem(
    itemKey: string,
    metadata: Partial<RetrievedMetadata>,
    pdfMetadata?: PDFMetadata,
    overwriteExisting: boolean = false,
  ): Promise<EnrichmentResult> {
    try {
      ztoolkit.log("[ItemCreator] 更新条目:", { itemKey, overwriteExisting });

      // 获取条目
      const item = Zotero.Items.getByLibraryAndKey(
        Zotero.Libraries.userLibraryID,
        itemKey,
      );

      if (!item) {
        throw new Error(`条目未找到: ${itemKey}`);
      }

      const fieldsUpdated: string[] = [];
      const fieldsSkipped: string[] = [];
      const tagsAdded: string[] = [];
      const metadataSources: MetadataSources = {
        webService: [],
        pdfProperties: [],
        manual: [],
      };

      // 更新字段（web服务元数据）
      if (metadata) {
        this.updateItemFields(
          item,
          metadata,
          overwriteExisting,
          fieldsUpdated,
          fieldsSkipped,
          metadataSources.webService,
        );
      }

      // 更新PDF属性
      if (pdfMetadata) {
        this.updatePDFFields(
          item,
          pdfMetadata,
          overwriteExisting,
          fieldsUpdated,
          fieldsSkipped,
          metadataSources.pdfProperties,
        );
      }

      // 合并标签
      if (metadata?.tags && metadata.tags.length > 0) {
        const existingTags = item.getTags().map((t: any) => t.tag);
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

      // 保存条目
      if (fieldsUpdated.length > 0 || tagsAdded.length > 0) {
        await item.saveTx();
        ztoolkit.log("[ItemCreator] 条目已更新:", {
          fieldsUpdated,
          tagsAdded,
        });
      } else {
        ztoolkit.log("[ItemCreator] 无需更新");
      }

      return {
        itemKey: item.key,
        fieldsUpdated,
        fieldsSkipped,
        tagsAdded,
        metadataSources,
      };
    } catch (error) {
      ztoolkit.log("[ItemCreator] 更新条目失败:", error, "error");
      throw error;
    }
  }

  /**
   * 设置条目字段（用于新条目）
   */
  private setItemFields(
    item: any,
    metadata: Partial<RetrievedMetadata>,
    fieldsSet: string[],
    sourceList: string[],
  ): void {
    const fieldMap: [keyof RetrievedMetadata, string][] = [
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
      ["numPages", "numPages"],
    ];

    for (const [metaField, itemField] of fieldMap) {
      if (metadata[metaField]) {
        try {
          item.setField(itemField, String(metadata[metaField]));
          fieldsSet.push(itemField);
          sourceList.push(itemField);
        } catch (error) {
          ztoolkit.log(
            `[ItemCreator] 设置字段失败 ${itemField}:`,
            error,
            "error",
          );
        }
      }
    }

    // 设置creators
    if (metadata.creators && metadata.creators.length > 0) {
      try {
        item.setCreators(metadata.creators);
        fieldsSet.push("creators");
        sourceList.push("creators");
      } catch (error) {
        ztoolkit.log("[ItemCreator] 设置creators失败:", error, "error");
      }
    }

    // 设置tags
    if (metadata.tags && metadata.tags.length > 0) {
      try {
        item.setTags(metadata.tags.map((t) => ({ tag: t })));
        fieldsSet.push("tags");
        sourceList.push("tags");
      } catch (error) {
        ztoolkit.log("[ItemCreator] 设置tags失败:", error, "error");
      }
    }
  }

  /**
   * 从PDF属性设置字段
   */
  private setPDFFields(
    item: any,
    pdfMetadata: PDFMetadata,
    fieldsSet: string[],
    sourceList: string[],
  ): void {
    // 只设置尚未设置的字段
    if (!item.getField("title") && pdfMetadata.title) {
      try {
        item.setField("title", pdfMetadata.title);
        fieldsSet.push("title");
        sourceList.push("title");
      } catch (error) {
        ztoolkit.log("[ItemCreator] 设置PDF标题失败:", error, "error");
      }
    }

    if (!item.getField("abstractNote") && pdfMetadata.subject) {
      try {
        item.setField("abstractNote", pdfMetadata.subject);
        fieldsSet.push("abstractNote");
        sourceList.push("abstractNote");
      } catch (error) {
        ztoolkit.log("[ItemCreator] 设置PDF主题失败:", error, "error");
      }
    }

    // 添加PDF关键词作为标签
    if (pdfMetadata.keywords && pdfMetadata.keywords.length > 0) {
      try {
        const existingTags = item.getTags();
        const newTags = [
          ...existingTags,
          ...pdfMetadata.keywords.map((k) => ({ tag: k })),
        ];
        item.setTags(newTags);
        fieldsSet.push("tags");
        sourceList.push("tags");
      } catch (error) {
        ztoolkit.log("[ItemCreator] 设置PDF关键词失败:", error, "error");
      }
    }
  }

  /**
   * 更新条目字段（用于现有条目）
   */
  private updateItemFields(
    item: any,
    metadata: Partial<RetrievedMetadata>,
    overwriteExisting: boolean,
    fieldsUpdated: string[],
    fieldsSkipped: string[],
    sourceList: string[],
  ): void {
    const fieldMap: [keyof RetrievedMetadata, string][] = [
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
      ["numPages", "numPages"],
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
          ztoolkit.log(
            `[ItemCreator] 更新字段失败 ${itemField}:`,
            error,
            "error",
          );
        }
      }
    }

    // 更新creators（如果为空或允许覆盖）
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
        ztoolkit.log("[ItemCreator] 更新creators失败:", error, "error");
      }
    }
  }

  /**
   * 从PDF属性更新字段
   */
  private updatePDFFields(
    item: any,
    pdfMetadata: PDFMetadata,
    overwriteExisting: boolean,
    fieldsUpdated: string[],
    fieldsSkipped: string[],
    sourceList: string[],
  ): void {
    // 更新标题
    if (pdfMetadata.title) {
      try {
        const currentTitle = item.getField("title");
        if (
          !currentTitle ||
          currentTitle.trim().length === 0 ||
          overwriteExisting
        ) {
          item.setField("title", pdfMetadata.title);
          fieldsUpdated.push("title");
          sourceList.push("title");
        } else {
          fieldsSkipped.push("title");
        }
      } catch (error) {
        ztoolkit.log("[ItemCreator] 更新PDF标题失败:", error, "error");
      }
    }

    // 更新摘要
    if (pdfMetadata.subject) {
      try {
        const currentAbstract = item.getField("abstractNote");
        if (
          !currentAbstract ||
          currentAbstract.trim().length === 0 ||
          overwriteExisting
        ) {
          item.setField("abstractNote", pdfMetadata.subject);
          fieldsUpdated.push("abstractNote");
          sourceList.push("abstractNote");
        } else {
          fieldsSkipped.push("abstractNote");
        }
      } catch (error) {
        ztoolkit.log("[ItemCreator] 更新PDF主题失败:", error, "error");
      }
    }
  }
}

/**
 * 创建的条目信息
 */
export interface CreatedItemInfo {
  itemKey: string;
  itemID: number;
  fieldsSet: string[];
  attachmentKey?: string;
  metadataSources: MetadataSources;
}

/**
 * 更新结果
 */
export interface EnrichmentResult {
  itemKey: string;
  fieldsUpdated: string[];
  fieldsSkipped: string[];
  tagsAdded: string[];
  metadataSources: MetadataSources;
}

/**
 * 元数据来源追踪
 */
export interface MetadataSources {
  webService: string[];
  pdfProperties: string[];
  manual: string[];
}
