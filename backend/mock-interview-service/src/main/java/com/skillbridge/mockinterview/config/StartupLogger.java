package com.skillbridge.mockinterview.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Enumeration;

@Configuration
public class StartupLogger {

    private static final Logger log = LoggerFactory.getLogger(StartupLogger.class);

    private final Environment environment;
    private final RestTemplate restTemplate;
    private final String whisperUrl;
    private final boolean whisperStartupProbe;

    public StartupLogger(Environment environment, RestTemplate restTemplate) {
        this.environment = environment;
        this.restTemplate = restTemplate;
        this.whisperUrl = environment.getProperty("whisper.url", "http://whisper-service:9000");
        this.whisperStartupProbe = Boolean.parseBoolean(
                environment.getProperty("whisper.startup-probe", "true"));
    }

    @EventListener(ApplicationReadyEvent.class)
    public void logStartupInfo() {
        String port = environment.getProperty("server.port", "8080");
        String contextPath = environment.getProperty("server.servlet.context-path", "");
        String localUrl = "http://localhost:" + port + contextPath;

        log.info("==========================================================");
        log.info("  SkillBridge AI — Mock Interview Service is running");
        log.info("  Local:      {}", localUrl);
        log.info("  Swagger UI: {}/swagger-ui/index.html", localUrl);
        log.info("  Health:     {}/mock-interview/health", localUrl);
        log.info("  Network:    {}", discoverNetworkUrl(port, contextPath));
        log.info("  Whisper:    {}", whisperUrl);
        if (whisperStartupProbe) {
            probeWhisper();
        }
        log.info("==========================================================");
    }

    private void probeWhisper() {
        try {
            restTemplate.headForHeaders(whisperUrl + "/");
            log.info("Whisper probe OK — voice path enabled");
        } catch (RestClientException e) {
            log.warn("WHISPER_URL unreachable — voice path disabled, typed answers still work: {}", e.getMessage());
        } catch (Exception e) {
            log.warn("WHISPER_URL unreachable — voice path disabled, typed answers still work: {}", e.getMessage());
        }
    }

    private String discoverNetworkUrl(String port, String contextPath) {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface ni = interfaces.nextElement();
                if (ni.isLoopback() || !ni.isUp()) continue;
                Enumeration<InetAddress> addresses = ni.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress addr = addresses.nextElement();
                    String host = addr.getHostAddress();
                    if (host != null && !host.contains(":")) {
                        return "http://" + host + ":" + port + contextPath;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Could not discover network IP", e);
        }
        return "unavailable";
    }
}
