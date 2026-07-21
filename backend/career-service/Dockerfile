# Build stage
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml ./
ENV MAVEN_OPTS="-Dmaven.wagon.rto=60000 -Dmaven.wagon.http.retryHandler.count=5"
RUN for i in 1 2 3; do mvn dependency:go-offline -B && break || sleep 30; done
COPY src ./src
RUN mvn package -DskipTests -B

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/career-service-*.jar app.jar
EXPOSE 8002
ENTRYPOINT ["java", "-jar", "app.jar"]
