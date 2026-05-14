import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { StorageConstruct } from "./constructs/storage-construct";
import { AuthConstruct } from "./constructs/auth-construct";
import { ProcessingConstruct } from "./constructs/processing-construct";
import { ApiConstruct } from "./constructs/api-construct";

export class IntelligentDocProcessingStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const storage = new StorageConstruct(this, "Storage");
        const auth = new AuthConstruct(this, "Auth");
        const processing = new ProcessingConstruct(this, "Processing", {
            uploadBucket: storage.uploadBucket,
            resultsBucket: storage.resultsBucket,
            encryptionKey: storage.key,
            table: storage.table
        })

        const api = new ApiConstruct(this, "Api", {
            userPool: auth.userPool,
            uploadBucket: storage.uploadBucket,
            resultsBucket: storage.resultsBucket,
            table: storage.table,
            encryptionKey: storage.key,
            eventBus: processing.eventBus
        })
    }
}

