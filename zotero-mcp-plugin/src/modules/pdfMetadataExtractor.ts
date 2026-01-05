import { PDFProcessor, PDFMetadata } from './pdfProcessor';

declare const ztoolkit: ZToolkit;

/**
 * PDF元数据提取器
 * 提供从PDF文件中提取元数据的高级功能
 */
export class PDFMetadataExtractor {
  private pdfProcessor: PDFProcessor;

  constructor(ztoolkit: any) {
    this.pdfProcessor = new PDFProcessor(ztoolkit);
  }

  /**
   * 从PDF文件提取元数据
   * @param pdfPath PDF文件的绝对路径
   * @returns Promise<PDFMetadata> 提取的元数据
   */
  async extractMetadata(pdfPath: string): Promise<PDFMetadata> {
    try {
      ztoolkit.log('[PDFMetadataExtractor] 开始提取PDF元数据:', { pdfPath });

      // 验证文件存在
      if (!pdfPath || pdfPath.trim().length === 0) {
        throw new Error('PDF路径为空');
      }

      // 使用PDFProcessor提取元数据
      const metadata = await this.pdfProcessor.extractMetadata(pdfPath);

      // 清理和规范化元数据
      const cleanedMetadata = this.cleanMetadata(metadata);

      ztoolkit.log('[PDFMetadataExtractor] 元数据提取完成:', cleanedMetadata);
      return cleanedMetadata;
    } catch (error) {
      ztoolkit.log('[PDFMetadataExtractor] 提取失败:', error, 'error');
      // 返回空元数据而不是抛出错误，以便优雅降级
      return {};
    }
  }

  /**
   * 清理和规范化PDF元数据
   * @param metadata 原始元数据
   * @returns 清理后的元数据
   */
  private cleanMetadata(metadata: PDFMetadata): PDFMetadata {
    const cleaned: PDFMetadata = {};

    // 清理标题
    if (metadata.title && metadata.title.trim().length > 0) {
      cleaned.title = this.cleanString(metadata.title);
    }

    // 清理作者
    if (metadata.author && metadata.author.trim().length > 0) {
      cleaned.author = this.cleanString(metadata.author);
    }

    // 清理主题/摘要
    if (metadata.subject && metadata.subject.trim().length > 0) {
      cleaned.subject = this.cleanString(metadata.subject);
    }

    // 清理关键词
    if (metadata.keywords && metadata.keywords.length > 0) {
      cleaned.keywords = metadata.keywords
        .map(k => this.cleanString(k))
        .filter(k => k.length > 0);
    }

    // 保留技术元数据
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

    if (metadata.pageCount !== undefined && metadata.pageCount > 0) {
      cleaned.pageCount = metadata.pageCount;
    }

    return cleaned;
  }

  /**
   * 清理字符串（去除多余空格、特殊字符等）
   * @param str 输入字符串
   * @returns 清理后的字符串
   */
  private cleanString(str: string): string {
    return str
      .trim()
      .replace(/\s+/g, ' ')  // 多个空格替换为单个空格
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // 移除控制字符
  }

  /**
   * 解析PDF日期格式
   * PDF日期格式: D:YYYYMMDDHHmmSSOHH'mm'
   * @param pdfDate PDF日期字符串
   * @returns ISO格式日期字符串
   */
  private parsePDFDate(pdfDate: string): string {
    try {
      // PDF日期格式示例: D:20230115120000+08'00'
      const match = pdfDate.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
      if (match) {
        const [, year, month, day, hour, minute, second] = match;
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).toISOString();
      }
      return pdfDate;
    } catch (error) {
      ztoolkit.log('[PDFMetadataExtractor] 日期解析失败:', error, 'error');
      return pdfDate;
    }
  }

  /**
   * 从PDF元数据中提取可能的标题
   * @param pdfPath PDF文件路径
   * @returns 可能的标题列表（按优先级排序）
   */
  async extractPossibleTitles(pdfPath: string): Promise<string[]> {
    const metadata = await this.extractMetadata(pdfPath);
    const titles: string[] = [];

    if (metadata.title) {
      titles.push(metadata.title);
    }

    if (metadata.subject && metadata.subject.length > 10 && metadata.subject.length < 200) {
      // 如果subject看起来像标题（长度合理），也加入候选
      titles.push(metadata.subject);
    }

    return titles;
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
