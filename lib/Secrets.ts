import * as rds from "@aws-cdk/aws-rds";
import {databaseAdminUserName, databaseSecretName} from "./consts/RDSConstants";
import {Stack} from "@aws-cdk/core";
import {Secret} from "@aws-cdk/aws-secretsmanager";


export class Secrets {

    static buildRDBSecret(stack: Stack): Secret {
        return new rds.DatabaseSecret(stack, databaseSecretName, {
                username: databaseAdminUserName
            }
        )
    }

}


