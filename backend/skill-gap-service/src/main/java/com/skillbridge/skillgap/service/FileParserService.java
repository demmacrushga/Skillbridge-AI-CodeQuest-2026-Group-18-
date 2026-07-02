package com.skillbridge.skillgap.service;

import com.skillbridge.skillgap.exception.FileParsingException;
import com.skillbridge.skillgap.exception.FileSizeExceededException;
import com.skillbridge.skillgap.exception.UnsupportedFileTypeException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

@Service
public class FileParserService {

    private static final Logger log = LoggerFactory.getLogger(FileParserService.class);

    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024 * 1024;
    private static final List<String> ALLOWED_MIME_TYPES = List.of(
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    public String extractText(MultipartFile file) {
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new FileSizeExceededException(
                    "File exceeds maximum allowed size of 5MB (received %d bytes)".formatted(file.getSize()));
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType)) {
            throw new UnsupportedFileTypeException(
                    "Unsupported file type '%s'. Only PDF and DOCX files are accepted.".formatted(contentType));
        }

        log.info("Extracting text from {} ({})", file.getOriginalFilename(), contentType);

        String text = contentType.equals("application/pdf")
                ? extractFromPdf(file)
                : extractFromDocx(file);

        if (text == null || text.isBlank()) {
            throw new FileParsingException("CV appears empty or unreadable after text extraction");
        }

        return text;
    }

    private String extractFromPdf(MultipartFile file) {
        try (PDDocument document = Loader.loadPDF(file.getBytes())) {
            return new PDFTextStripper().getText(document).strip();
        } catch (IOException e) {
            throw new FileParsingException("Failed to parse PDF: " + e.getMessage(), e);
        }
    }

    private String extractFromDocx(MultipartFile file) {
        try (InputStream is = file.getInputStream();
             XWPFDocument document = new XWPFDocument(is);
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
            return extractor.getText().strip();
        } catch (IOException e) {
            throw new FileParsingException("Failed to parse DOCX: " + e.getMessage(), e);
        }
    }
}
