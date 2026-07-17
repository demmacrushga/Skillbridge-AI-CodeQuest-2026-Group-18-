package com.skillbridge.portfolio.service;

import com.skillbridge.portfolio.exception.FileParsingException;
import com.skillbridge.portfolio.exception.FileSizeExceededException;
import com.skillbridge.portfolio.exception.UnsupportedFileTypeException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.*;

class FileParserServiceTest {

    private FileParserService service;

    @BeforeEach
    void setUp() {
        service = new FileParserService();
    }

    @Test
    void extractText_fileTooLarge_throwsFileSizeExceededException() {
        byte[] largeContent = new byte[(int) (5 * 1024 * 1024 + 1)];
        MockMultipartFile file = new MockMultipartFile(
                "file", "big.pdf", "application/pdf", largeContent);

        assertThatThrownBy(() -> service.extractText(file))
                .isInstanceOf(FileSizeExceededException.class)
                .hasMessageContaining("5MB");
    }

    @Test
    void extractText_unsupportedFileType_throwsUnsupportedFileTypeException() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "image.png", "image/png", "data".getBytes());

        assertThatThrownBy(() -> service.extractText(file))
                .isInstanceOf(UnsupportedFileTypeException.class)
                .hasMessageContaining("Only PDF and DOCX");
    }

    @Test
    void extractText_nullContentType_throwsUnsupportedFileTypeException() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "file.bin", (String) null, "data".getBytes());

        assertThatThrownBy(() -> service.extractText(file))
                .isInstanceOf(UnsupportedFileTypeException.class);
    }

    @Test
    void extractText_emptyPdf_throwsFileParsingException() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "empty.pdf", "application/pdf", createEmptyPdf());

        assertThatThrownBy(() -> service.extractText(file))
                .isInstanceOf(FileParsingException.class)
                .hasMessageContaining("empty or unreadable");
    }

    @Test
    void extractText_corruptedPdf_throwsFileParsingExceptionWithPasswordMessage() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "corrupt.pdf", "application/pdf", "not a real pdf".getBytes());

        assertThatThrownBy(() -> service.extractText(file))
                .isInstanceOf(FileParsingException.class)
                .hasMessageContaining("password-protected or corrupted");
    }

    private byte[] createEmptyPdf() {
        try (PDDocument document = new PDDocument()) {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            document.save(baos);
            return baos.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}
