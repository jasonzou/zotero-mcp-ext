import { PDFProcessor } from "./pdfProcessor";

declare const Zotero: any;
declare const ztoolkit: ZToolkit;

/**
 * Zotero元数据检索器
 * 使用Zotero的Translate.Search API从PDF或标识符（DOI、ISBN）检索元数据
 */
export class ZoteroMetadataRetriever {
  private pdfProcessor: PDFProcessor;
  private readonly timeout: number = 30000; // 30秒超时

  constructor(ztoolkit: any, timeout?: number) {
    this.pdfProcessor = new PDFProcessor(ztoolkit);
    if (timeout) {
      this.timeout = timeout;
    }
  }

  /**
   * 从PDF文件检索元数据（使用Zotero的web服务）
   * @param pdfPath PDF文件路径
   * @returns 检索到的元数据，失败返回null
   */
  async retrieveFromPDF(pdfPath: string): Promise<RetrievedMetadata | null> {
    try {
      ztoolkit.log("[ZoteroMetadataRetriever] 开始从PDF检索元数据:", {
        pdfPath,
      });

      // 提取PDF前几页的文本用于识别
      const fullText = await this.pdfProcessor.extractText(pdfPath);
      if (!fullText || fullText.trim().length === 0) {
        ztoolkit.log("[ZoteroMetadataRetriever] PDF文本为空，无法检索元数据");
        return null;
      }

      // 使用前2000字符用于元数据识别
      const sampleText = fullText.substring(0, 2000);

      // 尝试使用Zotero的recognizePDF功能
      const metadata = await this.recognizeFromText(sampleText);

      if (metadata) {
        ztoolkit.log("[ZoteroMetadataRetriever] 成功从PDF检索元数据");
        return metadata;
      }

      ztoolkit.log("[ZoteroMetadataRetriever] 无法从PDF文本识别元数据");
      return null;
    } catch (error) {
      ztoolkit.log(
        "[ZoteroMetadataRetriever] PDF元数据检索失败:",
        error,
        "error",
      );
      return null;
    }
  }

  /**
   * 从DOI检索元数据
   * @param doi DOI标识符
   * @returns 检索到的元数据，失败返回null
   */
  async retrieveFromDOI(doi: string): Promise<RetrievedMetadata | null> {
    try {
      ztoolkit.log("[ZoteroMetadataRetriever] 从DOI检索元数据:", { doi });

      const identifier = {
        itemType: "journalArticle",
        DOI: doi,
      };

      const metadata = await this.translateSearch(identifier);

      if (metadata) {
        ztoolkit.log("[ZoteroMetadataRetriever] 成功从DOI检索元数据");
        return metadata;
      }

      return null;
    } catch (error) {
      ztoolkit.log(
        "[ZoteroMetadataRetriever] DOI元数据检索失败:",
        error,
        "error",
      );
      return null;
    }
  }

  /**
   * 从ISBN检索元数据
   * @param isbn ISBN标识符
   * @returns 检索到的元数据，失败返回null
   */
  async retrieveFromISBN(isbn: string): Promise<RetrievedMetadata | null> {
    try {
      ztoolkit.log("[ZoteroMetadataRetriever] 从ISBN检索元数据:", { isbn });

      const identifier = {
        itemType: "book",
        ISBN: isbn,
      };

      const metadata = await this.translateSearch(identifier);

      if (metadata) {
        ztoolkit.log("[ZoteroMetadataRetriever] 成功从ISBN检索元数据");
        return metadata;
      }

      return null;
    } catch (error) {
      ztoolkit.log(
        "[ZoteroMetadataRetriever] ISBN元数据检索失败:",
        error,
        "error",
      );
      return null;
    }
  }

  /**
   * 从文本识别元数据（用于PDF识别）
   * @param text PDF文本样本
   * @returns 识别到的元数据
   */
  private async recognizeFromText(
    text: string,
  ): Promise<RetrievedMetadata | null> {
    try {
      // 使用Zotero的recognizePDF功能
      if (
        typeof Zotero.Recognize !== "undefined" &&
        Zotero.Recognize.recognizeItems
      ) {
        const results = await Promise.race([
          Zotero.Recognize.recognizeItems([{ text }]),
          this.createTimeout("PDF recognition timeout"),
        ]);

        if (results && results.length > 0 && results[0]) {
          return this.convertZoteroItem(results[0]);
        }
      }

      return null;
    } catch (error) {
      ztoolkit.log("[ZoteroMetadataRetriever] 文本识别失败:", error, "error");
      return null;
    }
  }

  /**
   * 使用Zotero.Translate.Search API检索元数据
   * @param identifier 标识符对象（DOI、ISBN等）
   * @returns 检索到的元数据
   */
  private async translateSearch(
    identifier: any,
  ): Promise<RetrievedMetadata | null> {
    try {
      const translate = new Zotero.Translate.Search();
      translate.setIdentifier(identifier);

      const translators = await Promise.race([
        translate.getTranslators(),
        this.createTimeout("Translator lookup timeout"),
      ]);

      if (!translators || translators.length === 0) {
        ztoolkit.log("[ZoteroMetadataRetriever] 未找到合适的translator");
        return null;
      }

      translate.setTranslator(translators);

      const newItems = await Promise.race([
        translate.translate(),
        this.createTimeout("Translation timeout"),
      ]);

      if (!newItems || newItems.length === 0) {
        ztoolkit.log("[ZoteroMetadataRetriever] Translation未返回结果");
        return null;
      }

      return this.convertZoteroItem(newItems[0]);
    } catch (error) {
      ztoolkit.log(
        "[ZoteroMetadataRetriever] Translate search失败:",
        error,
        "error",
      );
      return null;
    }
  }

  /**
   * 将Zotero item对象转换为RetrievedMetadata格式
   * @param item Zotero item对象
   * @returns 标准化的元数据对象
   */
  private convertZoteroItem(item: any): RetrievedMetadata {
    const metadata: RetrievedMetadata = {
      itemType: item.itemType || "document",
    };

    // 基本字段
    if (item.title) metadata.title = item.title;
    if (item.date) metadata.date = item.date;
    if (item.abstractNote) metadata.abstractNote = item.abstractNote;
    if (item.url) metadata.url = item.url;
    if (item.language) metadata.language = item.language;
    if (item.rights) metadata.rights = item.rights;

    // 出版信息
    if (item.publicationTitle)
      metadata.publicationTitle = item.publicationTitle;
    if (item.volume) metadata.volume = item.volume;
    if (item.issue) metadata.issue = item.issue;
    if (item.pages) metadata.pages = item.pages;

    // 标识符
    if (item.DOI) metadata.DOI = item.DOI;
    if (item.ISBN) metadata.ISBN = item.ISBN;
    if (item.ISSN) metadata.ISSN = item.ISSN;

    // 其他字段
    if (item.edition) metadata.edition = item.edition;
    if (item.publisher) metadata.publisher = item.publisher;
    if (item.place) metadata.place = item.place;
    if (item.series) metadata.series = item.series;
    if (item.seriesNumber) metadata.seriesNumber = item.seriesNumber;
    if (item.numPages) metadata.numPages = item.numPages;

    // Creators（作者、编辑等）
    if (
      item.creators &&
      Array.isArray(item.creators) &&
      item.creators.length > 0
    ) {
      metadata.creators = item.creators.map((c: any) => ({
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        creatorType: c.creatorType || "author",
      }));
    }

    // Tags
    if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
      metadata.tags = item.tags.map((t: any) =>
        typeof t === "string" ? t : t.tag,
      );
    }

    return metadata;
  }

  /**
   * 创建超时Promise
   * @param message 超时错误消息
   * @returns 超时Promise
   */
  private createTimeout(message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), this.timeout);
    });
  }

  /**
   * 释放资源
   */
  terminate(): void {
    if (this.pdfProcessor) {
      this.pdfProcessor.terminate();
    }
  }
}

/**
 * 检索到的元数据接口
 */
export interface RetrievedMetadata {
  itemType: string;
  title?: string;
  creators?: Array<{
    firstName: string;
    lastName: string;
    creatorType: string;
  }>;
  date?: string;
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  DOI?: string;
  ISBN?: string;
  ISSN?: string;
  abstractNote?: string;
  tags?: string[];
  url?: string;
  language?: string;
  rights?: string;
  edition?: string;
  publisher?: string;
  place?: string;
  series?: string;
  seriesNumber?: string;
  numPages?: string | number;
}
