import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { CfnOutput } from "aws-cdk-lib";


export class AuthConstruct extends Construct {
    public readonly userPool: cognito.UserPool;
    public readonly userPoolClient: cognito.UserPoolClient;
    
    constructor(scope: Construct, id: string){
        super(scope, id)

        this.userPool = new cognito.UserPool(this, "UserPool", {
            selfSignUpEnabled: true,
            signInAliases: { email: true},
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: false,
                requireDigits: false,
                requireSymbols: false,
                tempPasswordValidity: Duration.days(7),
            },
            mfa: cognito.Mfa.REQUIRED,
            mfaSecondFactor: {
                sms: false,
                otp: true
            },

            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY
        })

        this.userPoolClient = this.userPool.addClient("UserPoolClient", {
            authFlows: {
                userSrp: true,
                userPassword: false,
            }
        })

    }
    
}