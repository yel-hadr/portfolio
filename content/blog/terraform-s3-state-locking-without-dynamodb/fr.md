---
title: Terraform verrouille l’état S3 sans DynamoDB
summary: Depuis Terraform 1.10, le backend S3 peut verrouiller l’état avec un objet .tflock placé à côté du fichier d’état (use_lockfile = true). La fonctionnalité est stable depuis la 1.11, qui a rendu obsolète le verrouillage par DynamoDB.
---

## Le problème

Un état distant dans S3 a besoin d’un verrou, sinon deux `terraform apply` lancés en même temps peuvent écraser l’état l’un de l’autre. Pendant des années, le backend S3 ne savait verrouiller qu’au moyen d’une table DynamoDB séparée : une ressource de plus à créer, à autoriser et à payer, rien que pour tenir un verrou.

## Ce qui a changé

Depuis Terraform 1.10, le backend S3 sait verrouiller l’état tout seul. Avec `use_lockfile = true`, Terraform crée un objet de verrou à côté du fichier d’état, nommé d’après la clé de l’état avec le suffixe `.tflock`, et le supprime à la fin de l’opération.

Le mécanisme repose sur les écritures conditionnelles de S3 : l’objet de verrou n’est créé que s’il n’existe pas déjà. Si une autre exécution détient le verrou, l’écriture échoue et Terraform indique que l’état est verrouillé, comme il le faisait avec DynamoDB.

La fonctionnalité est stable depuis Terraform 1.11, qui a aussi rendu obsolète le verrouillage par DynamoDB. Plus besoin de table DynamoDB.

## La solution

Activez le fichier de verrou dans le bloc backend :

```hcl
terraform {
  required_version = ">= 1.11"

  backend "s3" {
    bucket       = "example-terraform-state"
    key          = "prod/network/terraform.tfstate"
    region       = "eu-west-3"
    encrypt      = true
    use_lockfile = true # objet de verrou : prod/network/terraform.tfstate.tflock
  }
}
```

Ensuite :

1. **Lancez `terraform init -reconfigure`.** Terraform l’exige dès que la configuration du backend change ; l’état lui-même ne bouge pas.
2. **Vérifiez les permissions.** Qui exécute Terraform a besoin de `s3:GetObject`, `s3:PutObject` et `s3:DeleteObject` sur la clé `.tflock`, en plus de l’accès habituel à l’objet d’état.
3. **Migrez par étapes si besoin.** Pour faciliter l’abandon de DynamoDB, `use_lockfile` et `dynamodb_table` peuvent être définis ensemble ; Terraform prend alors les deux verrous. Retirez `dynamodb_table` une fois que chaque pipeline et chaque poste utilisent la nouvelle configuration.

## Activez le versioning du bucket

Le verrou empêche les écritures simultanées ; il ne protège pas d’une mauvaise écriture. Activez le versioning sur le bucket d’état pour pouvoir restaurer une version antérieure du fichier d’état si un apply le corrompt ou si quelqu’un le supprime par erreur.

Si une exécution est interrompue et laisse un verrou orphelin, `terraform force-unlock <LOCK_ID>` le retire. Assurez-vous d’abord que rien d’autre n’est en cours.

## À retenir

Avec Terraform 1.11 ou plus, un bucket S3 versionné et `use_lockfile = true` suffisent au backend. La table de verrou DynamoDB peut disparaître.
