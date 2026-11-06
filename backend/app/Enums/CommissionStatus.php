<?php

namespace App\Enums;

enum CommissionStatus: string
{
    case EN_ATTENTE = 'EN_ATTENTE';
    case DUE = 'DUE';
    case VERSEE = 'VERSEE';
    case ANNULEE = 'ANNULEE';
}
