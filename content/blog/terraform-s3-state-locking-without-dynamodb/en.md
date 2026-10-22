---
title: Terraform can lock S3 state without DynamoDB
summary: Since Terraform 1.10, the S3 backend can lock state with a .tflock object next to the state file (use_lockfile = true). It is generally available since 1.11, which deprecated DynamoDB locking.
---

## The problem

Remote state in S3 needs a lock, or two `terraform apply` runs at the same time can overwrite each other's state. For years, the S3 backend could only lock through a separate DynamoDB table: one more resource to create, grant access to and pay for, just to hold a lock.

## What changed

Since Terraform 1.10, the S3 backend can lock state on its own. With `use_lockfile = true`, Terraform creates a lock object next to the state file, named after the state key with a `.tflock` suffix, and deletes it when the operation ends.

It relies on S3 conditional writes: the lock object is only created if it does not already exist. If another run holds the lock, the write fails and Terraform reports that the state is locked, as it did with DynamoDB.

The feature is generally available since Terraform 1.11, which also deprecated DynamoDB-based locking. No DynamoDB table is needed any more.

## The fix

Enable the lock file in the backend block:

```hcl
terraform {
  required_version = ">= 1.11"

  backend "s3" {
    bucket       = "example-terraform-state"
    key          = "prod/network/terraform.tfstate"
    region       = "eu-west-3"
    encrypt      = true
    use_lockfile = true # lock object: prod/network/terraform.tfstate.tflock
  }
}
```

Then:

1. **Run `terraform init -reconfigure`.** Terraform asks for it whenever the backend configuration changes; the state itself does not move.
2. **Check permissions.** Whoever runs Terraform needs `s3:GetObject`, `s3:PutObject` and `s3:DeleteObject` on the `.tflock` key, in addition to the usual access to the state object.
3. **Migrate in steps if needed.** To ease the move away from DynamoDB, `use_lockfile` and `dynamodb_table` can be set together; Terraform then takes both locks. Remove `dynamodb_table` once every pipeline and workstation uses the new configuration.

## Turn on bucket versioning

Locking prevents concurrent writes; it does not protect against a bad write. Enable versioning on the state bucket so you can restore an earlier version of the state file if an apply corrupts it or someone deletes it by mistake.

If a run is killed and leaves a stale lock behind, `terraform force-unlock <LOCK_ID>` removes it. Make sure nothing else is running first.

## Takeaway

On Terraform 1.11 and later, an S3 bucket with versioning and `use_lockfile = true` is all the backend needs. The DynamoDB lock table can go.
