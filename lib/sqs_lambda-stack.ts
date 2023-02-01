import * as lambda from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as cdk from "aws-cdk-lib";
import * as path from "path";

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class SqsLambdaStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dlqLambda = new NodejsFunction(this, "dlq-lambda", {
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "main",
      entry: path.join(__dirname, `/../src/dlq-lambda/index.ts`),
    });

    const deadLetterQueue = new sqs.Queue(this, "dead-letter-queue", {
      retentionPeriod: cdk.Duration.minutes(30),
    });

    dlqLambda.addEventSource(new SqsEventSource(deadLetterQueue));

    const queue = new sqs.Queue(this, "sqs-queue", {
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    const topic = new sns.Topic(this, "sns-topic");

    topic.addSubscription(new subs.SqsSubscription(queue));

    const myLambda = new NodejsFunction(this, "my-lambda", {
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "main",
      entry: path.join(__dirname, `/../src/my-lambda/index.ts`),
    });

    myLambda.addEventSource(
      new SqsEventSource(queue, {
        batchSize: 10,
      })
    );

    new cdk.CfnOutput(this, "snsTopicArn", {
      value: topic.topicArn,
      description: "The arn of the SNS topic",
    });
  }
}
