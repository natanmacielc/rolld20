docker run -d --rm --name rolld20-dynamo -p 8000:8000 amazon/dynamodb-local:3.3.1 -jar DynamoDBLocal.jar -inMemory -sharedDb
docker run -d --rm --name rolld20-s3 -p 9090:9090 adobe/s3mock:5.2.3
sleep 4
curl -s -X POST http://localhost:8000 \
  -H 'X-Amz-Target: DynamoDB_20120810.CreateTable' -H 'Content-Type: application/x-amz-json-1.0' \
  -H 'Authorization: AWS4-HMAC-SHA256 Credential=local/20260101/us-east-1/dynamodb/aws4_request, SignedHeaders=host, Signature=0' \
  -d '{"TableName":"rolld20","BillingMode":"PAY_PER_REQUEST","AttributeDefinitions":[{"AttributeName":"PK","AttributeType":"S"},{"AttributeName":"SK","AttributeType":"S"}],"KeySchema":[{"AttributeName":"PK","KeyType":"HASH"},{"AttributeName":"SK","KeyType":"RANGE"}]}'
curl -s -X PUT http://localhost:9090/rolld20-og

./mvnw -q -N install -DskipTests && ./mvnw -q -pl rolld20-core install -DskipTests
./mvnw -pl rolld20-app quarkus:dev -Dquarkus.analytics.disabled=true \
  -Drolld20.dynamodb.endpoint-override=http://localhost:8000 \
  -Drolld20.s3.endpoint-override=http://localhost:9090 \
  -Drolld20.public-base-url=http://localhost:8080