/**
 * Citation Formatter for Zotero MCP Plugin
 * Generates citations in various CSL styles
 */

/// <reference types="zotero-types" />

declare let ztoolkit: ZToolkit;
declare const Zotero: any;

/**
 * Get available citation styles
 */
export function getAvailableStyles(): Array<{ id: string; name: string }> {
  return [
    { id: "apa", name: "APA (7th edition)" },
    { id: "chicago-author-date", name: "Chicago (Author-Date)" },
    { id: "harvard1", name: "Harvard" },
    { id: "ieee", name: "IEEE" },
    { id: "mla", name: "MLA (9th edition)" },
    { id: "nature", name: "Nature" },
    { id: "vancouver", name: "Vancouver" },
    { id: "bibtex", name: "BibTeX" },
  ];
}

/**
 * Get user's preferred citation style from Zotero settings
 */
export function getPreferredStyle(): string {
  try {
    // Try to get from Zotero preferences
    const exportStyle = Zotero.Prefs.get("export.format") as string;
    if (exportStyle && exportStyle.includes("csl")) {
      return exportStyle;
    }
  } catch (e) {
    ztoolkit.log(`[CitationFormatter] Error getting preferred style: ${e}`);
  }
  return "apa"; // Default to APA
}

/**
 * Generate a citation for a single item
 * @param item The Zotero.Item object
 * @param style The citation style (e.g., "apa", "chicago-author-date", "ieee", etc.)
 * @param format Output format: "html", "text", "bibtex"
 * @returns Formatted citation
 */
export async function generateCitation(
  item: Zotero.Item,
  style: string = "apa",
  format: "html" | "text" | "bibtex" = "text",
): Promise<Record<string, any>> {
  const startTime = Date.now();
  ztoolkit.log(
    `[CitationFormatter] Generating ${style} citation for item: ${item.key}`,
  );

  try {
    // Handle BibTeX separately
    if (style === "bibtex" || format === "bibtex") {
      return generateBibTeX(item, "text");
    }

    // For CSL styles, use Zotero's citation API
    let citation: string;

    try {
      // Use Zotero's built-in citation generation
      // Try to use the newer API first
      if (typeof (item as any).getCitation === "function") {
        citation = await (item as any).getCitation(style);
      } else {
        // Fallback: construct citation manually
        citation = constructCitation(item, style);
      }

      // Get full bibliography entry
      // if (typeof (item as any).getBibliography === "function") {
      //   formattedBibliography = await (item as any).getBibliography(style);
      // }
    } catch (citationError) {
      ztoolkit.log(
        `[CitationFormatter] CSL citation error, using fallback: ${citationError}`,
      );
      // Fallback to manual citation construction
      citation = constructCitation(item, style);
    }

    // Format output based on requested format
    let output: string;
    switch (format) {
      case "html":
        output = citation;
        break;
      default:
        // Strip HTML tags for plain text
        output = stripHtmlTags(citation);
    }

    // Get item metadata for response
    const metadata = getCitationMetadata(item, style);

    ztoolkit.log(
      `[CitationFormatter] Citation generated in ${Date.now() - startTime}ms`,
    );

    return {
      itemKey: item.key,
      title: item.getDisplayTitle(),
      style: style,
      styleName: getStyleName(style),
      format,
      citation: output,
      formattedCitation: citation,
      bibtex: generateBibTeX(item, format).citation,
      metadata,
      generatedAt: new Date().toISOString(),
      processingTime: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    ztoolkit.log(
      `[CitationFormatter] Error generating citation: ${err.message}`,
      "error",
    );
    throw err;
  }
}

/**
 * Generate citations for multiple items
 */
export async function generateMultipleCitations(
  items: Zotero.Item[],
  style: string = "apa",
  format: "html" | "text" | "bibtex" = "text",
): Promise<Record<string, any>> {
  const startTime = Date.now();
  ztoolkit.log(
    `[CitationFormatter] Generating ${style} citations for ${items.length} items`,
  );

  const citations: Array<Record<string, any>> = [];
  const errors: Array<{ itemKey: string; error: string }> = [];

  for (const item of items) {
    try {
      const citation = await generateCitation(item, style, format);
      citations.push(citation);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push({
        itemKey: item.key,
        error: err.message,
      });
    }
  }

  return {
    style,
    styleName: getStyleName(style),
    format,
    totalItems: items.length,
    successful: citations.length,
    failed: errors.length,
    citations,
    errors,
    generatedAt: new Date().toISOString(),
    processingTime: `${Date.now() - startTime}ms`,
  };
}

/**
 * Generate BibTeX entry for an item
 */
function generateBibTeX(
  item: Zotero.Item,
  format: "html" | "text",
): Record<string, any> {
  const key = generateBibTeXKey(item);
  const entryType = mapItemTypeToBibTeX(item.itemType);

  // Get creators
  const creators = item.getCreators();
  const authorParts: string[] = [];
  const authorFirstParts: string[] = [];

  for (const creator of creators) {
    const lastName = (creator as any).lastName || "";
    const firstName = (creator as any).firstName || "";
    const creatorType = Zotero.CreatorTypes.getName(
      (creator as any).creatorTypeID,
    );

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

  // Build BibTeX entry
  const fields: string[] = [];

  if (author) fields.push(`  author = {${author}}`);
  if (item.getField("title"))
    fields.push(`  title = {${item.getField("title")}}`);
  if (item.getField("date"))
    fields.push(
      `  year = {${item.getField("date").toString().substring(0, 4)}}`,
    );
  if (item.getField("publicationTitle"))
    fields.push(`  journal = {${item.getField("publicationTitle")}}`);
  if (item.getField("volume"))
    fields.push(`  volume = {${item.getField("volume")}}`);
  if (item.getField("issue"))
    fields.push(`  number = {${item.getField("issue")}}`);
  if (item.getField("pages"))
    fields.push(`  pages = {${item.getField("pages")}}`);
  if (item.getField("DOI")) fields.push(`  doi = {${item.getField("DOI")}}`);
  if (item.getField("url")) fields.push(`  url = {${item.getField("url")}}`);
  if (item.getField("abstractNote")) {
    const abstract = item
      .getField("abstractNote")
      .toString()
      .replace(/[\r\n]+/g, " ");
    fields.push(
      `  abstract = {${abstract.substring(0, 500)}${abstract.length > 500 ? "..." : ""}}`,
    );
  }

  const bibtex = `@${entryType}{${key},
${fields.join(",\n")}
}`;

  return {
    key,
    entryType,
    citation: format === "html" ? `<pre>${bibtex}</pre>` : bibtex,
    formattedCitation: bibtex,
  };
}

/**
 * Generate BibTeX key from item
 */
function generateBibTeXKey(item: Zotero.Item): string {
  const creators = item.getCreators();
  let firstAuthor = "";

  for (const creator of creators) {
    const creatorType = Zotero.CreatorTypes.getName(
      (creator as any).creatorTypeID,
    );
    if (creatorType === "author" && (creator as any).lastName) {
      firstAuthor = (creator as any).lastName
        .toLowerCase()
        .replace(/[^a-z]/g, "");
      break;
    }
  }

  const year = item.getField("date")
    ? item.getField("date").toString().substring(0, 4)
    : "nodate";
  const titleWord = item.getField("title")
    ? item
        .getField("title")
        .toString()
        .split(" ")[0]
        .toLowerCase()
        .replace(/[^a-z]/g, "")
    : "item";

  return `${firstAuthor}${year}${titleWord}`.substring(0, 50);
}

/**
 * Map Zotero item type to BibTeX entry type
 */
function mapItemTypeToBibTeX(itemType: string): string {
  const typeMap: Record<string, string> = {
    journalArticle: "article",
    book: "book",
    bookSection: "incollection",
    magazineArticle: "article",
    newspaperArticle: "article",
    thesis: "phdthesis",
    conferencePaper: "inproceedings",
    report: "techreport",
    webpage: "misc",
    document: "misc",
    email: "misc",
    audioRecording: "misc",
    videoRecording: "misc",
    film: "misc",
    artwork: "misc",
    presentation: "misc",
    interview: "misc",
    letter: "misc",
    memo: "misc",
    note: "misc",
    attachment: "misc",
  };

  return typeMap[itemType] || "misc";
}

/**
 * Construct citation manually when CSL is unavailable
 */
function constructCitation(item: Zotero.Item, style: string): string {
  const title = item.getField("title") || "Untitled";
  const date = item.getField("date");
  const year = date ? date.toString().substring(0, 4) : "n.d.";
  const creators = item.getCreators();
  const publicationTitle = item.getField("publicationTitle");
  const volume = item.getField("volume");
  const issue = item.getField("issue");
  const pages = item.getField("pages");

  // Format authors
  const authorNames = creators
    .filter(
      (c: any) => Zotero.CreatorTypes.getName(c.creatorTypeID) === "author",
    )
    .map((c: any) => {
      if (c.lastName && c.firstName) {
        return `${c.lastName}, ${c.firstName.charAt(0)}.`;
      }
      return c.lastName || "";
    });

  const authorStr = authorNames.join(", ");
  const firstAuthorLast = authorNames[0]?.split(",")[0] || "Unknown";

  switch (style.toLowerCase()) {
    case "apa":
    case "apa-7":
      // APA 7th edition format
      if (authorNames.length === 0) {
        return `${title}. (${year}).`;
      } else if (authorNames.length === 1) {
        return `${authorNames[0]}. (${year}). ${title}.`;
      } else if (authorNames.length === 2) {
        return `${authorStr}. (${year}). ${title}.`;
      } else if (authorNames.length <= 20) {
        const allAuthors =
          authorNames.slice(0, -1).join(", ") +
          ", & " +
          authorNames[authorNames.length - 1];
        return `${allAuthors}. (${year}). ${title}.`;
      } else {
        // APA 7th: up to 20 authors
        const first19 = authorNames.slice(0, 19).join(", ");
        const last = authorNames[19];
        return `${first19}, ... ${last}. (${year}). ${title}.`;
      }

    case "harvard1":
      // Harvard format
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
      // Chicago Author-Date
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
      // IEEE format
      const ieeeAuthors =
        authorNames.length <= 6
          ? authorNames.join(authorNames.length > 2 ? ", " : " and ")
          : `${authorNames.slice(0, 6).join(", ")} and ${authorNames.length - 6} others`;
      const pubInfo = publicationTitle
        ? `${publicationTitle}${volume ? `, ${volume}` : ""}${issue ? `(${issue})` : ""}${pages ? `, ${pages}` : ""}`
        : "";
      return `${ieeeAuthors}, "${title}"${pubInfo ? `, ${pubInfo}` : ""}.`;

    case "mla":
    case "mla-9":
      // MLA 9th edition
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
      // Nature
      const natureAuthors =
        authorNames.length <= 5
          ? authorNames.join(", ")
          : `${firstAuthorLast} et al.`;
      return `${natureAuthors} ${title}. ${publicationTitle || ""}${volume ? ` ${volume}` : ""}${pages ? `, ${pages}` : ""} (${year}).`;

    case "vancouver":
      // Vancouver
      const vanAuthors =
        authorNames.length <= 6
          ? authorNames
              .map((n: string, i: number) =>
                i === authorNames.length - 1 ? `& ${n}` : n,
              )
              .join(", ")
          : `${authorNames.slice(0, 6).join(", ")} et al.`;
      return `${vanAuthors}. ${title}. ${publicationTitle || ""}${volume ? ` ${volume}` : ""}${issue ? `(${issue})` : ""}:${pages || ""}. ${year}.`;

    default:
      // Default to simple format
      if (authorNames.length === 0) {
        return `${title} (${year})`;
      } else if (authorNames.length === 1) {
        return `${authorNames[0]}, ${title} (${year})`;
      } else {
        return `${firstAuthorLast} et al., ${title} (${year})`;
      }
  }
}

/**
 * Strip HTML tags from citation
 */
function stripHtmlTags(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Get human-readable style name
 */
function getStyleName(style: string): string {
  const styleNames: Record<string, string> = {
    apa: "APA (7th edition)",
    "apa-7": "APA (7th edition)",
    "chicago-author-date": "Chicago (Author-Date)",
    harvard1: "Harvard",
    ieee: "IEEE",
    mla: "MLA (9th edition)",
    "mla-9": "MLA (9th edition)",
    nature: "Nature",
    vancouver: "Vancouver",
    bibtex: "BibTeX",
  };
  return styleNames[style.toLowerCase()] || style;
}

/**
 * Get citation metadata for an item
 */
function getCitationMetadata(
  item: Zotero.Item,
  _style: string,
): Record<string, any> {
  return {
    itemKey: item.key,
    itemType: item.itemType,
    title: item.getDisplayTitle(),
    authors: item
      .getCreators()
      .filter(
        (c: any) => Zotero.CreatorTypes.getName(c.creatorTypeID) === "author",
      )
      .map((c: any) => ({
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        fullName: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
      })),
    date: item.getField("date") || null,
    publicationTitle: item.getField("publicationTitle") || null,
    volume: item.getField("volume") || null,
    issue: item.getField("issue") || null,
    pages: item.getField("pages") || null,
    doi: item.getField("DOI") || null,
    url: item.getField("url") || null,
    zoteroUrl: `zotero://select/library/items/${item.key}`,
  };
}

/**
 * Validate a citation style
 */
export function isValidStyle(style: string): boolean {
  const validStyles = [
    "apa",
    "apa-7",
    "chicago-author-date",
    "harvard1",
    "ieee",
    "mla",
    "mla-9",
    "nature",
    "vancouver",
    "bibtex",
  ];
  return validStyles.includes(style.toLowerCase());
}

/**
 * Get default citation style
 */
export function getDefaultStyle(): string {
  return "apa";
}
